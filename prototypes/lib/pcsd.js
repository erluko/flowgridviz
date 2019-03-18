var readline = require('readline');
var fs = require('fs');

function ipStrToInt(s){
  // ">>>0" thanks to http://2ality.com/2012/02/js-integers.html
  let octets = s.split('.');
  return (octets[0]<<24 | octets[1] <<16 | octets[2]<<8 |octets[3] )>>>0;
}


module.exports.fromFile = function(fname){
  return new Promise(function(resolve,reject){
    let rows;
    try {
      rows = [];//new Array(Math.ceil(fs.statSync(fname).size/39));
    } catch (e){
      return reject(e)
    }

    var rl = readline.createInterface({
      input: fs.createReadStream(fname)
    });

    rl.on('line', function(line){
      //147.32.84.180 86.126.40.27   1063 3128
      let idx = 0;
      let space = false;
      let row = new Array(4).fill('');
      for(c of line){
        if(c == ' '){
          if(!space){
            space = true;
            idx++;
          }
        } else {
          space = false;
          row[idx]+=c;
        }
      }
      row[0] = ipStrToInt(row[0]);
      row[1] = ipStrToInt(row[1]);
      row[2] = +row[2];
      row[3] = +row[3];
      rows.push(row);
    }).on('close',_=>resolve(rows))
  })};

