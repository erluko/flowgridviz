const http = require('http');
const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const LRU = require("lru-cache")
const me = require('./lib/matrixexplorer');

const slist = require('./js/servicelist.js');
const phr = require('./js/porthasher.js');
let ph0 = new phr.porthasher({portmap: slist.servicemap,
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


const port = 3000;
const ip = '127.17.96.39';

let mwcache = new LRU(80);

let phwalk = function(pth){
  if(typeof matrix === 'undefined'){
    return [];
  }
  let bcount = 256
  let sports = new Set(matrix.sports);
  let spmax = matrix.sports[matrix.sports.length-1];
  let dports = new Set(matrix.dports);
  let dpmax = matrix.dports[matrix.dports.length-1];

  let lph = ph0;
  let mwk = [];
  for(let [[xt,yt],idx] of pth) {
    //xt and yt are either 'p' meaning port of 'i' meaning ip
    //ignoring xt and yt for now. Treating both as 'p'
    if(idx != null){
      mwk.push(idx);
      [sports,dports,lph] = mwcache
        .getOrSet(JSON.stringify(mwk), function(){
          let x = idx % bcount;
          let y = Math.floor(idx / bcount);
          let sps = lph.backhash(y,spmax).filter(p=>sports.has(p));
          let dps = lph.backhash(x,dpmax).filter(p=>dports.has(p));
          return [new Set(sps),
                  new Set(dps),
                  new phr.porthasher({portlist: sps.concat(dps),
                                      only: true})]
        });
      spmax = undefined;
      dpmax = undefined;
    }
  }
  return [sports,dports,lph];
};

let mwalk = function(pth){
  let [sports,dports,lph] = phwalk(pth);
  return me.getMatrix(lph,packets.filter(r=>sports.has(r[2]) &&
                                          dports.has(r[3])));
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

app.get('/',(req,res) => res.redirect('/pp/index.html'));
app.get('/favicon.ico',function (req,res){
  //thanks to http://transparent-favicon.info/favicon.ico
  res.sendFile('favicon.ico',{root:'images'});
});
app.get('/js/:script.js',function (req,res){
  res.sendFile(req.params['script']+'.js',{root:'js'});
});
app.get('/out/:script.js',function (req,res){
  res.sendFile(req.params['script']+'.js',{root:'out'});
});
app.get('*/index.html',function(req,res){
  res.render('index',{
    key: 'index',
    render: function(window,sdone) {
      let document = window.document;
      let svg = document.createElement("svg");
      svg.setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");

      document.body.appendChild(svg);
      for(i=0;i<256*256;i++){
        let a = document.createElement("a");
        a.setAttribute("class","plot");
        let r = document.createElement("rect");
        r.setAttribute("class","plot");
        a.appendChild(r);
        svg.appendChild(a);
      }
    }})});

app.get('*/matrix.json',function(req,res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  let lmat = mwalk(pp);
  res.json(lmat);
});
app.get('*/pmatrix.js',function(req,res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  let lmat = mwalk(pp);
  res.send(jsonWrap('pmatrix',lmat));
});
app.get('*/viewhash.js',function(req,res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  let [sports,dports,lph] = phwalk(pp);
  res.json(/*{sports:Array.from(sports),
            dports:Array.from(dports),
            ph:*/ lph/*}*/);
});

app.get('/pcap.json',(req,res)=>res.json(packets));

app.get('/*/pcap.json',function(req,res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  let [sports,dports,lph] = phwalk(pp);
  res.json(packets.filter(r=>sports.has(r[2]) &&
                          dports.has(r[3])))
});


console.log("Reading pcap data");
(require('./lib/pcsd')
  .fromFile('data/pcap.txt.gz')
  .then(function(p){
    packets = p;
    matrix = me.getMatrix(ph0,packets);
    var server = http.createServer(app);
    server.on("error", e =>console.log(`Unable to start server: ${e}`));
    server.listen(port, ip, () => console.log(`Packet capture visualization app listening on http://${ip}:${port}!`));
  }));

