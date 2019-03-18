const express = require('express');
const app = express();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

app.engine('html', function (filename, options, callback) {
  JSDOM.fromFile(filename).then(dom => {
    options || (options = { render: _ => null});
    options.render(dom.window);
    callback(null, dom.serialize());
  });
})

app.set('view engine', 'html');


const port = 3000;
const ip = '127.17.96.39';

const me = require('./js/matrixexplorer');

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/matrix/*', function(req, res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  res.render('matrix',{
    render: function(window,done) {
      let doc = window.document;
      let t = doc.createTextNode(JSON.stringify(pp));
      doc.getElementsByTagName("body")[0].appendChild(t);
    }
  });
});

app.listen(port, ip, () => console.log(`Example app listening on http://${ip}:${port}!`))
