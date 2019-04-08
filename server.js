const fs = require('fs');
const http = require('http');
const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const LRU = require("lru-cache")

const me = require('./lib/matrixexplorer');
const pu = require('./js/pathutil');
const tsf = require('./js/filtermaker');
const slist = require('./lib/servicelist.js');
const phr = require('./js/nethasher.js');

let inputs = new Map(JSON.parse(fs.readFileSync("./data/inputs.json")));

let ph0 = new phr.nethasher();
let ph0_servs = new phr.nethasher(slist.servicemap);
let pth0 = pu.pathParser("/pp/");
let labels  = new Map();
let records = new Map();
let all_ready = false;

let dyn_root = 'viz/';

LRU.prototype.getOrSet = function(k,f){
  let v = this.get(k);
  if(typeof v === 'undefined'){
    v = f();
    this.set(k,v);
  }
  return v;
}


app.engine('html',require('./lib/jsdt')({cache: new LRU(30)}));
app.set('view engine', 'html');


const port = process.env.npm_package_config_port;
const ip = process.env.npm_package_config_listen_ip;
const max_records = (s=>s?(s.toLowerCase()=='all'?0:+s||0):0)(process.env.npm_package_config_max_records);
let url_root = process.env.npm_package_config_url_root || '/';
if(!url_root.endsWith("/")) url_root=url_root+'/';
if(!url_root.startsWith("/")) url_root='/'+url_root;

function NotReadyException(thing) {
  this.thing = thing;
}

let mwcache = new LRU(80);

let phwalk = function(rname,pth){
  if(pth == null || pth.length <1){
    pth = pth0;
  }
  //Apply the service list only at top level and only if showing ports
  //on at least one axis:
  let lph = (pth[0][0][0]=='p' ||
             pth[0][0][1]=='p')?ph0_servs:ph0;
  let pkts = records.get(rname);
  if(!pkts){
    throw new NotReadyException(rname);
  }
  let bcount = phr.nethasher.getBucketCount();
  let mwk = [rname];

  let matrix;
  for(let [[stype,dtype],idx] of pth) {
    //stype and dtype are either 'p' meaning port of 'i' meaning ip
    matrix = me.getMatrix(lph,stype,dtype,pkts)
    let sources = new Set(matrix.sources);
    let dests = new Set(matrix.dests);
    let idxs = me.idxsForTypes(stype,dtype);
    if(idx != null){
      mwk.push(''+stype+dtype+idx);
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
      pkts = pkts.filter(r=>sources.has(r[idxs[0]]) &&
                         dests.has(r[idxs[1]]));

    }
  }
  return [matrix,pkts];
};

let mwalk = function(rname,pth){
  let [matrix,pkts] = phwalk(rname,pth);
  return matrix;
}


/* sed mimicry */

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

app.get(url_root+dyn_root,(req,res) => res.redirect(url_root+'inputs.html'));
app.get(url_root,(req,res) => res.redirect(url_root+'inputs.html'));
app.get(url_root+'index.html',(req,res) => res.redirect(url_root+'inputs.html'));

// The favicon route intentionally does not use url_root, it is only used if url_root == '/'
app.get('/favicon.ico',function (req,res){
  //thanks to http://transparent-favicon.info/favicon.ico
  res.sendFile('favicon.ico',{root:'images'});
});

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


app.get(url_root+'inputs.html',function(req,res){
  res.render('inputs',{
    key: 'inputs'+all_ready,
    render: function(window,sdone) {
      let document = window.document;
      if(all_ready){
        document.getElementById("readyscript").remove()
      }
      let holder = document.getElementById("sources");
      for(name of inputs.keys()){
        if(name.indexOf('/') == -1){
          let a = document.createElement("a");
          a.setAttribute("href",dyn_root + name+"/");
          a.appendChild(document.createTextNode(inputs.get(name).title));
          holder.appendChild(a);
          holder.appendChild(document.createElement("br"));
        } else {
          console.log("Bad data source name");
        }
      }
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

app.get(url_root+dyn_root+':input/',function(req,res){
  let rname = req.params['input'];
  res.redirect(url_root+dyn_root+rname+'/pp/index.html');
});

app.get(url_root+dyn_root+':input/index.html',function(req,res){
  let rname = req.params['input'];
  res.redirect(url_root+dyn_root+rname+'/pp/index.html');
});

app.get(url_root+dyn_root+':input/*/index.html',function(req,res){
  let rname = req.params['input'];
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req,res)) return;
  res.render('index',{
    key: rname+'/index',
    render: function(window,sdone) {
      let document = window.document;
      Array.from(document.getElementsByTagName("script")).forEach(reroot(rname,"src"));
      Array.from(document.getElementsByTagName("link")).forEach(reroot(rname,"href"));
    }});
});
app.get(url_root+dyn_root+':input/labels.json',function(req,res){
  let rname = req.params['input'];
  let ls = labels.get(rname);
  res.json(ls);
});
app.get(url_root+dyn_root+':input/labels.js',function(req,res){
  let rname = req.params['input'];
  let ls = labels.get(rname);
  res.type("text/javascript");
  res.send(jsonWrap("labels",ls));
});
app.get(url_root+dyn_root+':input/input.json',function(req,res){
  let rname = req.params['input'];
  let inp= inputs.get(rname);
  res.json([rname,inp]);
});
app.get(url_root+dyn_root+':input/input.js',function(req,res){
  let rname = req.params['input'];
  let inp = inputs.get(rname);
  res.type("text/javascript");
  res.send(jsonWrap("input",[rname,inp]));
});
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

app.get(url_root+dyn_root+':input/ready.js',function(req,res){
  let rname = req.params['input'];
  res.type("text/javascript").send(jsonWrap('ready',records.has(rname)));
});

app.get(url_root+dyn_root+':input/ready.json',function(req,res){
  let rname = req.params['input'];
  res.json(records.has(rname));
});

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
app.get(url_root+dyn_root+':input/filter.txt',function(req,res){
  res.type("text/plain")
  res.send("tcp or udp\n");
});

app.get(url_root+dyn_root+':input/pcap.json',function(req,res){
  let rname = req.params['input'];
  let recs = records.get(rname);
  if(recs){
    res.json(recs);
  } else {
    res.status(409).json({error: "Resource not ready, try again later"})
  }
});

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

console.log("Reading records");
let startTime=new Date().getTime();
let dots = setInterval(()=>console.log("."), 5000);


let inputParser = require('./lib/pcsd');

let proms = [];
for([key,input] of inputs){
  let f = input.file;
  let prom = inputParser.fromFile('data/'+f,{max: max_records,
                                             no_label: input.no_label});
  proms.push(prom);
  prom.then((function(key,input,[p,l]){
    console.log(input)
      let readyTime = new Date().getTime();
      let elapsedSecs = ((readyTime - startTime)/1000).toFixed(3);
      console.log(`Loaded ${p.length} records in ${elapsedSecs} seconds from ${input.file}`);
      labels.set(key,l);
      records.set(key,p);
      phwalk(key, pth0); //initialize matrix cache
  }).bind(null,key,input));
  //above use of bind inspired by:
  // https://stackoverflow.com/questions/32912459/promises-pass-additional-parameters-to-then-chain
}

Promise.all(proms).then(function(){
  clearInterval(dots);
  console.log('All inputs loaded');
  all_ready = true;
});

var server = http.createServer(app);
server.on("error", e =>console.log(`Unable to start server: ${e}`));
server.listen(port, ip, () => console.log(`pcapviz listening on http://${ip}:${port}${url_root}!`));
