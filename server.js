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

//FIXME: Using servicemap here will affect ip hashing. Is there some
//       way to distinguish ports from ips for just the first view?
let ph0 = new phr.nethasher({valuemap: slist.servicemap,
                             only:false});
let packets = null;
let matrix = null;

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
  if(typeof matrix === 'undefined'){
    return [];
  }
  let sources = new Set(matrix.sources);
  let spmax = matrix.sources[matrix.sources.length-1];
  let dests = new Set(matrix.dests);
  let dpmax = matrix.dests[matrix.dests.length-1];

  let bcount = phr.nethasher.getBucketCount();
  let lph = ph0;
  let stype = 'p';
  let dtype = 'p';
  let mwk = [];
  for(let [[xt,yt],idx] of pth) {
    //xt and yt are either 'p' meaning port of 'i' meaning ip
    //ignoring xt and yt for now. Treating both as 'p'
    stype = yt;
    dtype = xt;
    if(idx != null){
      mwk.push(xt+yt+idx);
      [sources,dests,lph] = mwcache
        .getOrSet(JSON.stringify(mwk), function(){
          let x = idx % bcount;
          let y = Math.floor(idx / bcount);
          let sps = lph.backhash(y,spmax).filter(p=>sources.has(p));
          let dps = lph.backhash(x,dpmax).filter(p=>dests.has(p));
          return [new Set(sps),
                  new Set(dps),
                  new phr.nethasher({portlist: sps.concat(dps),
                                      only: true})]
        });
      spmax = undefined;
      dpmax = undefined;
    }
  }
  return [sources,dests,stype,dtype,lph];
};

let mwalk = function(pth){
  let [sources,dests,stype,dtype,lph] = phwalk(pth);
  //FIXME: change [2] [3] to something based on stype/dtype
  return me.getMatrix(lph,stype,dtype,packets.filter(r=>sources.has(r[2]) &&
                                                     dests.has(r[3])));
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

function reroot(attr){
   return function(n){
     let old=n.getAttribute(attr);
     if(old.startsWith("/")){
       n.setAttribute(attr,url_root+old.substr(1))
     }
   }
}

app.get(url_root+'*/index.html',function(req,res){
  res.render('index',{
    key: 'index',
    render: function(window,sdone) {
      let document = window.document;
      Array.from(document.getElementsByTagName("script")).forEach(reroot("src"));
      Array.from(document.getElementsByTagName("link")).forEach(reroot("href"));
    }});
});
app.get(url_root+'*/matrix.json',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  let lmat = mwalk(pp);
  res.json(lmat);
});
app.get(url_root+'*/pmatrix.js',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  let lmat = mwalk(pp);
  res.send(jsonWrap('pmatrix',lmat));
});

app.get(url_root+'*/filter.txt',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  let [sources,dests,stype,dtype,lph] = phwalk(pp);
  res.type("text/plain")
  res.send(tsf.tsDisplayFilter(sources,dests,stype,dtype)+"\n");
});
app.get(url_root+'filter.txt',function(req,res){
  res.type("text/plain")
  res.send("tcp or udp\n");
});

app.get(url_root+'pcap.json',(req,res)=>res.json(packets));

app.get(url_root+'*/pcap.json',function(req,res){
  let ps = req.params['0'];
  let pp = pu.pathParser(ps);
  let [sources,dests,stype,dtype,lph] = phwalk(pp);
  //FIXME: change [2] [3] to something based on stype/dtype
  res.json(packets.filter(r=>sources.has(r[2]) &&
                          dests.has(r[3])))
});

console.log("Reading pcap data");
let startTime=new Date().getTime();
let dots = setInterval(()=>console.log("."), 5000);

(require('./lib/pcsd')
  .fromFile('data/pcap.txt.gz')
  .then(function(p){
    clearInterval(dots);
    let readyTime = new Date().getTime();
    let elapsedSecs = ((readyTime - startTime)/1000).toFixed(3);
    console.log(`Loaded pcap in ${elapsedSecs} seconds.`);
    packets = p;
    let stype = 'p';
    let dtype = 'p';
    matrix = me.getMatrix(ph0,stype,dtype,packets);
    var server = http.createServer(app);
    server.on("error", e =>console.log(`Unable to start server: ${e}`));
    server.listen(port, ip, () => console.log(`Packet capture visualization app listening on http://${ip}:${port}${url_root}!`));
  }));

