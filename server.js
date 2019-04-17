// npm modules
const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const LRU = require("lru-cache")
const httpSignature = require('http-signature');
const bodyParser = require('body-parser');

// allow jsonParser to ignore content-type header
var jsonParser = bodyParser.json({type: _=>true})


// local modules
const me = require('./lib/matrixexplorer');
const pu = require('./js/pathutil');
const tsf = require('./js/filtermaker');
const slist = require('./lib/servicelist.js');
const phr = require('./js/nethasher.js');



let allowedInputKeys = new Set(['file','url','initial','title','no_label','ref']);
function verifyInputFormat(input){
  return (input != null &&
          typeof(input) == 'object' &&
          Object.keys(input).every(k=>allowedInputKeys.has(k)) &&
          (input.file ==null || input.url == null));
  // Only one of "file" or "url" can be specified
}

// load list of input datasources
let inputs_r = new Map(JSON.parse(fs.readFileSync("./data/inputs.json")));
let inputs = new Map();
for([key,input] of inputs_r){
  if(verifyInputFormat(input)){
    inputs.set(key,input)
  } else {
    console.log(`Rejecting malformed input "${key}"`)
  }
}

/* ph0 is the default un-configured hasher to use for the initial top-level
   views where no axis shows ports */
let ph0 = new phr.nethasher();

/* ph0_servs is a hasher configured to know about common service
   ports. It is used for top-level views where at least one axis shows ports. */
let ph0_servs = new phr.nethasher(slist.servicemap);

let labels  = new Map(); // per-dataset list of labels
let records = new Map(); // per-dataset list of flows or packets
let statuses = new Map();// per-dataset object showing loading status

// dynamic urls all start with this prefix:
let dyn_root = 'viz/';

// every LRU should have a get-or-set method
LRU.prototype.getOrSet = function(k,f){
  let v = this.get(k);
  if(typeof v === 'undefined'){
    v = f();
    this.set(k,v);
  }
  return v;
}

/* load the Javascript DOM Template library I created for this project,
   give it a 30-element LRU cache,
   and set it as the template engine to use for html.*/
// TODO: make the LRU size configurable
app.engine('html',require('./lib/jsdt')({cache: new LRU(30)}));
app.set('view engine', 'html');

// configured port should the server listen on?
const port = process.env.npm_package_config_port;

// configured IP address to listen on
const ip = process.env.npm_package_config_listen_ip;

// configured directory storing authorized key files for API caller authentication
const key_dir = process.env.npm_package_config_key_dir;

// configured *per-dataset* upper limit on records to load
const max_records = (s=>s?(s.toLowerCase()=='all'?0:+s||0):0)(process.env.npm_package_config_max_records);

// base for all urls, usually "pcv" in production
let url_root = process.env.npm_package_config_url_root || '/';
if(!url_root.endsWith("/")) url_root=url_root+'/';
if(!url_root.startsWith("/")) url_root='/'+url_root;

// a simple exception type to use
function NotReadyException(thing) {
  this.thing = thing;
}

// cache to hold 80 different matrix walks
// TODO: make the size configurable
let mwcache = new LRU(80);

// Port x Port, Port x IP, IP x Port, IP x IP
let legalViews=new Set(['pp','pi','ip','ii']);

/* Each dataset can set a default view.
   If none is specified, start with Port x Port */
let defaultView = function(rname){
  let inp = inputs.get(rname);
  let view = (inp?inp.initial:null);
  return legalViews.has(view)?view:'pp';
}

/* Originally "porthasher walker", now the "ph" is just an artifact of
   the days before pcapviz supported flows and IPs.

   TODO: rename phwalk

   Given a dataset name and a path string to walk, performs the walk.
   See MatrixExplorer for more details */
let phwalk = function(rname,pth){
  // Use selected path or the default if none is specified
  if(pth == null || pth.length <1){
    pth = pu.pathParser('/'+defaultView(rname)+'/');
  }
  //Apply the service list only at top level and only if showing ports
  //on at least one axis:
  let lph = (pth[0][0][0]=='p' ||
             pth[0][0][1]=='p')?ph0_servs:ph0;

  // pkts is the list of records to consider in this walk
  let pkts = records.get(rname);
  if(!pkts){
    /* this only happens if someone requests a url that depends
       on the records for a nonexistent or not-yet-loaded dataset.
       One common cause would be a server restart. */
    throw new NotReadyException(rname);
  }
  let bcount = phr.nethasher.getBucketCount();

  // mwk ("matrix walk" is used as the cache key, it starts with the dataset name)
  let mwk = [rname];

  let matrix;
  for(let [[stype,dtype],idx] of pth) {
    //stype and dtype are either 'p' meaning port of 'i' meaning ip
    //idx is the coordinate of the cell to enter (y*bcount+x)
    matrix = me.getMatrix(lph,stype,dtype,pkts)
    let sources = new Set(matrix.sources);
    let dests = new Set(matrix.dests);
    /* idxs is the list of indices into the columns of each record
       that represent the requested data.
       The native storage is src-ip, dest-ip, src-port, dst-port, ...
       So for view 'pp' idxs = [2,3]
       and for view 'ip' idxs = [0,3]
       See matrixexplorer.js
    */
    let idxs = me.idxsForTypes(stype,dtype);
    if(idx != null){
      // extend the cache key
      mwk.push(''+stype+dtype+idx);
      // either read from cache or caclulate the next answer
      [sources,dests,lph] = mwcache
        .getOrSet(JSON.stringify(mwk), function(){
          let x = idx % bcount;
          let y = Math.floor(idx / bcount);
          let sps = lph.backhash(y,sources);
          let dps = lph.backhash(x,dests);
          return [new Set(sps),
                  new Set(dps),
                  new phr.nethasher(sps.concat(dps).map((v,i)=>[v,i]))];
        });
      // keep on the records left after walking into the matrix
      pkts = pkts.filter(r=>sources.has(r[idxs[0]]) &&
                         dests.has(r[idxs[1]]));

    }
  }
  /* return the newly calculated (or fetched from cache) matrix,
     and the list of packets or flows it represents */
  return [matrix,pkts];
};


// Matrix Walk, it's just a helper around a common use of phwalk
let mwalk = function(rname,pth){
  let [matrix,pkts] = phwalk(rname,pth);
  return matrix;
}


/* This function is essentially sed mimicry.
   Early versions of the code used 'sed' at install-time to convert
   json files into javascript files loadable via a script tag, essentially
   a safer form of jsonp. For the few bits of code that depended on this,
   we have jsonWrap() which duplicates the old sed script behavior.
 */
function jsonWrap(n,d){
  let j = JSON.stringify(d);
  return `(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));
  var root = inNode?module.exports:this;

  if(typeof root.IMPORT_DATA === 'undefined'){
    root.IMPORT_DATA = new Map();
  }
  // NOTE: this section is filled in by sed.
  let data = [
    ${j}
  ]; //end data
  if(data.length == 1) {
    data = data[0];
  }
  root.IMPORT_DATA.set('${n}',data);
})();
`;
}


// reroot() Prepends the base address to absolute paths in the DOM
function reroot(rname,attr){
   return function(n){
     let s=n.getAttribute(attr);
     if(s.startsWith("/")){
       s = s.substr(1);
       if(s.lastIndexOf("/")<1){
         s = dyn_root+rname +"/"+s;
       }
       n.setAttribute(attr,url_root+s)
     }
   }
}

// Define some basic routes to redirect to the "starting" page.
app.get(url_root+dyn_root,(req,res) => res.redirect(url_root+'inputs.html'));
app.get(url_root,(req,res) => res.redirect(url_root+'inputs.html'));
app.get(url_root+'index.html',(req,res) => res.redirect(url_root+'inputs.html'));

// The favicon route intentionally does not use url_root, it is only used if url_root == '/'
app.get('/favicon.ico',function (req,res){
  //thanks to http://transparent-favicon.info/favicon.ico
  res.sendFile('favicon.ico',{root:'images'});
});

// Handle all static file paths. Express handles rejecting path traversal attacks.
app.get(url_root+'images/:imagefile',function (req,res){
  //thanks to http://www.ajaxload.info/
  res.sendFile(req.params['imagefile'],{root:'images'});
});
app.get(url_root+'style/:cssfile',function (req,res){
  res.sendFile(req.params['cssfile'],{root:'style'});
});
app.get(url_root+'js/:script.js',function (req,res){
  res.sendFile(req.params['script']+'.js',{root:'js'});
});
app.get(url_root+'js-ext/:script.js',function (req,res){
  res.sendFile(req.params['script']+'.js',{root:'js-ext'});
});

let homeurl=url_root+'inputs.html';
// route for actually generating responses to requests for inputs.html
app.get(homeurl,function(req,res){
  let all_ready = Array.from(statuses.values()).every(v=>v.status!="loading");
  res.render('inputs',{
    // "inputs" above tells the viewer to fetch view/inputs.html
    // the value of key: below is used as the cache key in the view layer
    key: 'inputs'+all_ready,
    render: function(window,sdone) {
      /* given a DOM-like structure, modify it to represent the intended
         output DOM. Why not use the built-in express templates? They are
         vulnerable to XSS. This is not. */
      let document = window.document;
      if(all_ready){
        /* when all sources have been processed, we can ditch the script
           tag that polls for loading state */
        document.getElementById("readyscript").remove()
      }
      // Generate <img> and <a> tags for each data source
      let holder = document.getElementById("sources");
      for(name of inputs.keys()){
        /* prevent path weirdness in data source names. */
        if(name.indexOf('/') == -1){
          let img = document.createElement("img");
          let status = (statuses.get(name) || {status: 'failed'})['status'];
          img.setAttribute("src", status=='ready'?"images/checkbox.png":
                           status=='failed'?"images/redx.png":
                           "images/loading-sm.gif");
          holder.appendChild(img);
          let a = document.createElement("a");
          if (status != 'failed'){
            /* the "readyscript" polls for readiness of all href-having
               anchor tags, don't provide an href for known-bad sources */
            a.setAttribute("href",dyn_root + name+"/");
          }
          a.appendChild(document.createTextNode(inputs.get(name).title));
          holder.appendChild(a);
          holder.appendChild(document.createElement("br"));
        } else {
          console.log("Bad data source name");
        }
      }
      // fix absolute urls be re-rooting them:
      Array.from(document.getElementsByTagName("script")).forEach(reroot('',"src"));
      Array.from(document.getElementsByTagName("link")).forEach(reroot('',"href"));
    }});
});

function forceValidRedirect(pp,req,res){
  //FIXME: this whole function is a hack to fix bad urls
  if(pu.isValidFinalPath(pp)){
    return false;
  }
  pp = pu.makeValidFinalPath(pp);
  let l=Object.entries(req.params).reduce((a,[k,v])=>a+v.length+1,dyn_root.length);
  let fname = req.path.substr(l);
  newpath = url_root+req.params['input']+"/"+pu.toPathStr(pp)+fname;
  res.redirect(newpath);
  return true;
}


/* When visiting a data-source with no 'pp', 'ip', etc., go to the default view
   for that data source. */
app.get(url_root+dyn_root+':input/',function(req,res){
  let rname = req.params['input'];
  res.redirect(url_root+dyn_root+rname+'/'+defaultView(rname)+'/index.html');
});
app.get(url_root+dyn_root+':input/index.html',function(req,res){
  let rname = req.params['input'];
  res.redirect(url_root+dyn_root+rname+'/'+defaultView(rname)+'/index.html');
});

// Render the matrix view for the selected input and path
app.get(url_root+dyn_root+':input/*/index.html',function(req,res){
  let rname = req.params['input']; // the data source name
  let ps = req.params['0']; // the matrix path
  let pp = pu.pathParser(ps); // the parsed matrix path
  if(forceValidRedirect(pp,req,res)) return; // fix bad urls (hack)
  res.render('index',{
    // 'index' above tells the viewer to fetch view/index.html
    // the value of key: below is used as the cache key in the view layer
    key: rname+'/index',
    render: function(window,sdone) {
      let document = window.document;
      // fix all absolure urls in the document:
      Array.from(document.getElementsByTagName("img")).forEach(reroot(rname,"src"));
      Array.from(document.getElementsByTagName("script")).forEach(reroot(rname,"src"));
      Array.from(document.getElementsByTagName("link")).forEach(reroot(rname,"href"));
    }});
});

/* This route is unused by the application, but is available for debugging
   and for future work */
app.get(url_root+dyn_root+':input/labels.json',function(req,res){
  let rname = req.params['input'];
  let ls = labels.get(rname);
  res.json(ls);
});

// This route makes the labels for the selected data set available in-browser
app.get(url_root+dyn_root+':input/labels.js',function(req,res){
  let rname = req.params['input'];
  let ls = labels.get(rname);
  res.type("text/javascript");
  res.send(jsonWrap("labels",ls));
});

/* This route is unused by the application, but is available for debugging
   and for future work */
app.get(url_root+dyn_root+':input/input.json',function(req,res){
  let rname = req.params['input'];
  let inp= inputs.get(rname);
  res.json([rname,inp,homeurl]);
});

/* This route makes the input definition for the selected data set
   available in-browser */
app.get(url_root+dyn_root+':input/input.js',function(req,res){
  let rname = req.params['input'];
  let inp = inputs.get(rname);
  res.type("text/javascript");
  res.send(jsonWrap("input",[rname,inp,homeurl]));
});

/* This route is unused by the application, but is available for debugging
   and for future work */
app.get(url_root+dyn_root+':input/*/matrix.json',function(req,res){
  let rname = req.params['input'];
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req,res)) return;
  try{
    let lmat = mwalk(rname,pp);
    res.json(lmat);
  } catch(e) {
    if(e instanceof NotReadyException){
      res.status(409).json({error: "Resource not ready, try again later"})
    } else {
      throw e;
    }
  }
});

/* This route is makes the matrix for the seleted data set and matrix path
   available in-browser. */
app.get(url_root+dyn_root+':input/*/pmatrix.js',function(req,res){
  let rname = req.params['input'];
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req,res)) return;
  try{
    let lmat = mwalk(rname,pp);
    res.type("text/javascript");
    res.send(jsonWrap('pmatrix',lmat));
  } catch(e) {
    if(e instanceof NotReadyException){
      res.status(409).type("text/javascript").send(jsonWrap("pmatrix",{error: "Resource not ready, try again later"}));
    } else {
      throw e;
    }
  }
});

function verifyRequestAuthorization(req){
  let parsed = httpSignature.parseRequest(req);
  let key_file = parsed.keyId.replace("/","_");
  let pubkeydata = (function(){
    try{
      return fs.readFileSync(key_dir+'/'+key_file+'.pem', 'ascii');
    } catch (e) {
      return null;
    }
  })();

  let info = { passed: false,
               key_id: parsed.keyId,
               headers: parsed.params.headers};
  if(pubkeydata != null){
    info.passed = httpSignature.verifySignature(parsed, pubkeydata);
  }
  return info;
}

function loadInput(key,input,proms) {
  initStatus(key);
  let prom = null;
  if(input.file){
    if(input.file.indexOf("/") >=0 ){
      // reject files that have path traversal characters
      recordLoadFailure(key,"Illegal input file name")
    } else {
      // get a promise for the parsed data
      prom = FlowParser.flowsFromFile('data/'+input.file,{max: max_records,
                                                          no_label: input.no_label});
    }
  } else if(input.url) {
    prom = FlowParser.flowsFromURL(input.url,{max: max_records,
                                              no_label: input.no_label});
  }
  if(prom != null) {
    /* Without this rather annoying catch(_=>{}), the error which is handled
       just fine in the 'failure' function bubbles up again in Promise.all(...).
       When Promise.protoype.finally() is added to the standard, this won't be
       necessary. */
    if(proms) {
      proms.push(prom.catch(_=>{}));
    }
    prom.then(acceptLoadedInput.bind(null,key),
              recordLoadFailure.bind(null,key));
  }
  //above use of bind inspired by:
  // https://stackoverflow.com/questions/32912459/promises-pass-additional-parameters-to-then-chain
}

app.put(url_root+dyn_root+':input/configure',jsonParser,function(req,res){
  let rname = req.params['input'];
  let verif = verifyRequestAuthorization(req)
  if(!(verif.passed && verif.headers.includes('date') && verif.headers.includes('digest'))){
    res.status(401).type("text/plain").send("Signature authorization with a known public key is required over at least the date and digest headers. See: https://tools.ietf.org/html/draft-cavage-http-signatures-10");
  } else {
    let update = req.body;
    if(verifyInputFormat(update)){
      clearLoadedInput(rname);
      inputs.set(rname,update);
      loadInput(rname,update);
      res.json(update);
    } else {
      res.status(400).type("text/plain").send("Invalid input specification")
    }
  }
});

app.put(url_root+'/auth_check',function(req,res){
  let verif = verifyRequestAuthorization(req)
  res.json(verif)
});

// Used for forcing the reload of a named data source
app.post(url_root+dyn_root+':input/reload/',function(req,res){
  let verif = verifyRequestAuthorization(req)
  if(!(verif.passed && verif.headers.includes('date') && verif.headers.includes('digest'))){
    res.status(401).type("text/plain").send("Signature authorization with a known public key is required over at least the date and digest headers. See: https://tools.ietf.org/html/draft-cavage-http-signatures-10");
  }  else {
    let rname = req.params['input'];
    let input = inputs.get(rname);
    clearLoadedInput(rname);
    let prom = FlowParser.flowsFromURL(input.url,{max: max_records,
                                                  no_label: input.no_label});

    prom.then(acceptLoadedInput.bind(null,rname),
              recordLoadFailure.bind(null,rname));
    res.redirect(homeurl)
  }
});


// Used for polling ready state (used in-browser)
app.get(url_root+dyn_root+':input/ready.js',function(req,res){
  let rname = req.params['input'];
  res.type("text/javascript").send(jsonWrap('ready',statuses.get(rname)));
});

// Used for examining ready state via curl, etc
app.get(url_root+dyn_root+':input/ready.json',function(req,res){
  let rname = req.params['input'];
  res.json(statuses.get(rname));
});

/* Potentially useful for building applications that fetch filter rules
   for particular matrix paths, but not used by this application at the moment */
app.get(url_root+dyn_root+':input/*/filter.txt',function(req,res){
  let rname = req.params['input'];
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req,res)) return;
  try {
    let matrix = mwalk(rname,pp);
    res.type("text/plain")
    res.send(tsf.tsDisplayFilter(matrix.sources,
                                 matrix.dests,
                                 matrix.stype,
                                 matrix.dtype)+"\n");
  } catch(e) {
    if(e instanceof NotReadyException){
      res.status(409).type("text/plain").send("error: Resource not ready, try again later");
    } else {
      throw e;
    }
  }
});
// As above, but for the default (no-path) rule
app.get(url_root+dyn_root+':input/filter.txt',function(req,res){
  res.type("text/plain")
  res.send("tcp or udp\n");
});

// Unused route for getting a view into the selected data set's records
app.get(url_root+dyn_root+':input/pcap.json',function(req,res){
  let rname = req.params['input'];
  let recs = records.get(rname);
  if(recs){
    res.json(recs);
  } else {
    res.status(409).json({error: "Resource not ready, try again later"})
  }
});

/* Unused route for getting a view into the selected data set's records
   for the given matrix path */
app.get(url_root+dyn_root+':input/*/pcap.json',function(req,res){
  let rname = req.params['input'];
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req,res)) return;
  try {
    let [matrix,pkts] = phwalk(rname,pp);
    res.json(pkts);
  } catch(e) {
    if(e instanceof NotReadyException){
      res.status(409).json({error: "Resource not ready, try again later"})
    } else {
      throw e;
    }
  }
});

// "main" code that executes when 'npm start' is run begins here.

console.log("Reading records");
let startTime=new Date().getTime();
let dots = setInterval(()=>console.log("."), 5000);

// TODO: move require() calls to the top
const FlowParser = require('./lib/flowparser');

function initStatus(key){
  statuses.set(key,{status:"loading",start:new Date().getTime()});
}
function updateStatus(key,attr,val){
  let status = statuses.get(key);
  status[attr]=val;
}
function  clearLoadedInput(key){
  labels.delete(key);
  records.delete(key);
  initStatus(key);
  mwcache.forEach(function(_,ckey,c){
    let ck=JSON.parse(ckey);
    if(ck.length && ck[0]==key) {
      c.del(ckey);
    }
  })
}

function  recordLoadFailure(key,why){
  console.log(inputs.get(key));
  let status = statuses.get(key);
  updateStatus(key,'status',"failed");
  updateStatus(key,'error',why);
  updateStatus(key,'done',new Date().getTime());
  console.log(`Failed to load "${key}": ${why}`);
}

function  acceptLoadedInput(key,[p,l]){
  let input = inputs.get(key)
  console.log(input)
  updateStatus(key,'done',new Date().getTime());
  updateStatus(key,'record_count',p.length)
  labels.set(key,l);
  records.set(key,p);
  updateStatus(key,'status',"ready");
  let status = statuses.get(key);
  let elapsedSecs = ((status.done - status.start)/1000).toFixed(3);
  console.log(`Loaded ${status.record_count} records in ${elapsedSecs} seconds for "${key}"`);
}


// List of promises to track:
let proms = [];
for([key,input] of inputs){
  loadInput(key, input, proms)
}

Promise.all(proms).then(function(){
  // when all promises are done, the "inputs" page is simplified.
  clearInterval(dots);
  console.log('All inputs loaded');
})

//Start the server at the selected IP and port
var server = http.createServer(app);
server.on("error", e =>console.log(`Unable to start server: ${e}`));
server.listen(port, ip, () => console.log(`pcapviz listening on http://${ip}:${port}${url_root}!`));
