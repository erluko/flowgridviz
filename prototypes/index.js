const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const LRU = require("lru-cache")
const me = require('./lib/matrixexplorer');

const slist = require('./js/servicelist.js');
const phr = require('./js/porthasher.js');
let ph = new phr.porthasher({portmap: slist.servicemap,
                             only:false});
let packets = null;
let matrix = null;

(require('./lib/pcsd')
  .fromFile('data/pcap.txt')
  .then(function(p){
    packets = p;
    matrix = me.getMatrix(ph,packets);
    console.log("ready");
  }));

app.engine('html',require('./lib/jsdt')({cache: new LRU(30)}));
app.set('view engine', 'html');


const port = 3000;
const ip = '127.17.96.39';

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/matrix/*', function(req, res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  res.render('matrix',{
    key: pp,
    render: function(window,sdone) {
      let doc = window.document;
      let t = doc.createTextNode(packets?JSON.stringify(pp)+"\n"+packets.length:"No Packets Yet");
      doc.getElementsByTagName("body")[0].appendChild(t);
    }
  });
});


let mwalk = function(pth){
  if(typeof ph === 'undefined'
     || typeof matrix === 'undefined'){
    return [];
  }
  bcount = 256
  let sports = new Set(matrix.sports);
  let spmax = matrix.sports[matrix.sports.length-1];
  let dports = new Set(matrix.dports);
  let dpmax = matrix.dports[matrix.dports.length-1];

  let lph = ph;
  for(let [[x,y],idx] of pth) {
    //ignoring x and y for now. Treating both as 'p'
    if(idx != null){
      let x = idx % bcount;
      let y = Math.floor(idx / bcount);
      let sps = lph.backhash(y,spmax).filter(p=>sports.has(p));
      let dps = lph.backhash(x,dpmax).filter(p=>dports.has(p));
      sports = sps;
      dports = dps;
      lph = new phr.porthasher({portlist: sps.concat(dps),
                                only: true})
      spmax = undefined;
      dpmax = undefined;
    }
  }
  return me.getMatrix(lph,packets);
}


app.get('/*/matrix.json',function(req,res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  let lmat = mwalk(pp);
  res.json(lmat);
});
app.get('/pcap.json',(req,res)=>res.json(packets));


app.listen(port, ip, () => console.log(`Example app listening on http://${ip}:${port}!`))
