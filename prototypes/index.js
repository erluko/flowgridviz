const express = require('express');
const app = express();
app.engine('html', require('express-views-dom')(app));


const port = 3000;
const ip = '127.17.96.39';

const me = require('./js/matrixexplorer');

app.get('/', (req, res) => res.send('Hello World!'))
app.get('/matrix/*', function(req, res){
  let ps = req.params['0'];
  let pp = me.pathParser(ps);
  res.send('Hello World!')
});

app.listen(port, ip, () => console.log(`Example app listening on http://${ip}:${port}!`))
