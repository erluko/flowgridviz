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

let ph0 = new phr.nethasher();
let ph0_servs = new phr.nethasher(slist.servicemap);
let pth0 = pu.pathParser("/pp/");
let packets = null;
let labels  = null;

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
let url_root = process.env.npm_package_config_url_root || '/';
if(!url_root.endsWith("/")) url_root=url_root+'/';
if(!url_root.startsWith("/")) url_root='/'+url_root;

let mwcache = new LRU(80);

let phwalk = function(pth){
  if(pth == null || pth.length <1){
    pth = pth0;
  }
  //Apply the service list only at top level and only if showing ports
  //on at least one axis:
  let lph = (pth[0][0][0]=='p' ||
             pth[0][0][1]=='p')?ph0_servs:ph0;
  let pkts = packets;

  let bcount = phr.nethasher.getBucketCount();
  let mwk = [];

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

let mwalk = function(pth){
  let [matrix,pkts] = phwalk(pth);
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

app.get(url_root,(req,res) => res.redirect(url_root+'pp/index.html'));
app.get(url_root+'index.html',(req,res) => res.redirect(url_root+'pp/index.html'));

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

function forceValidRedirect(pp,fname,res){
  if(pu.isValidFinalPath(pp)){
    return false;
  }
  pp = pu.makeValidFinalPath(pp);
  newpath = url_root+pu.toPathStr(pp)+fname;
  res.redirect(newpath);
  return true;
}

function reroot(attr){
   return function(n){
     let old=n.getAttribute(attr);
     if(old.startsWith("/")){
       n.setAttribute(attr,url_root+old.substr(1))
     }
   }
}

app.get(url_root+'*/index.html',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req.url.substr(url_root.length+ps.length),res)) return;
  res.render('index',{
    key: 'index',
    render: function(window,sdone) {
      let document = window.document;
      Array.from(document.getElementsByTagName("script")).forEach(reroot("src"));
      Array.from(document.getElementsByTagName("link")).forEach(reroot("href"));
    }});
});
app.get(url_root+'labels.json',function(req,res){
  res.json(labels);
});
app.get(url_root+'labels.js',function(req,res){
  res.send(jsonWrap("labels",labels));
});
app.get(url_root+'*/matrix.json',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req.url.substr(url_root.length+ps.length),res)) return;
  let lmat = mwalk(pp);
  res.json(lmat);
});
app.get(url_root+'*/pmatrix.js',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req.url.substr(url_root.length+ps.length),res)) return;
  let lmat = mwalk(pp);
  res.send(jsonWrap('pmatrix',lmat));
});

app.get(url_root+'*/filter.txt',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req.url.substr(url_root.length+ps.length),res)) return;
  let matrix = mwalk(pp);
  res.type("text/plain")
  res.send(tsf.tsDisplayFilter(matrix.sources,
                               matrix.dests,
                               matrix.stype,
                               matrix.dtype)+"\n");
});
app.get(url_root+'filter.txt',function(req,res){
  res.type("text/plain")
  res.send("tcp or udp\n");
});

app.get(url_root+'pcap.json',(req,res)=>res.json(packets));

app.get(url_root+'*/pcap.json',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  if(forceValidRedirect(pp,req.url.substr(url_root.length+ps.length),res)) return;
  let [matrix,pkts] = phwalk(pp);
  res.json(pkts);
});

console.log("Reading records");
let startTime=new Date().getTime();
let dots = setInterval(()=>console.log("."), 5000);

(require('./lib/pcsd')
 .fromFile('data/input.gz')
 .then(function([p,l]){
   clearInterval(dots);
   let readyTime = new Date().getTime();
   let elapsedSecs = ((readyTime - startTime)/1000).toFixed(3);
   console.log(`Loaded ${p.length} records in ${elapsedSecs} seconds.`);
   packets = p;
   labels = l;
   var server = http.createServer(app);
   phwalk(pth0) //initialize matrix cache
   server.on("error", e =>console.log(`Unable to start server: ${e}`));
   server.listen(port, ip, () => console.log(`pcapviz listening on http://${ip}:${port}${url_root}!`));
 }));

