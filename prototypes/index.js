const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const LRU = require("lru-cache")
let packets = null;

require('./lib/pcsd').fromFile('data/pcap.txt').then(p=>packets=p);

app.engine('html',require('./lib/jsdt')({cache: new LRU(30)}));
app.set('view engine', 'html');


const port = 3000;
const ip = '127.17.96.39';

const me = require('./js/matrixexplorer');

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/matrix/*', function(req, res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  res.render('matrix',{
    key: pp,
    render: function(window,done) {
      let doc = window.document;
      let t = doc.createTextNode(packets?JSON.stringify(pp)+"\n"+packets.length:"No Packets Yet");
      doc.getElementsByTagName("body")[0].appendChild(t);
    }
  });
});


app.listen(port, ip, () => console.log(`Example app listening on http://${ip}:${port}!`))
