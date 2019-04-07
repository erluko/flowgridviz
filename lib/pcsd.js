var readline = require('readline');
var fs = require('fs');
const zlib = require('zlib');

function ipStrToInt(s){
  // ">>>0" thanks to http://2ality.com/2012/02/js-integers.html
  let octets = s.split('.');
  return (octets[0]<<24 | octets[1] <<16 | octets[2]<<8 |octets[3] )>>>0;
}


module.exports.fromFile = function(fname,options){
  const max = options?options.max||0:0;
  const no_label = options?(options.no_label || 'No Label'): 'No Label';
  return new Promise(function(resolve,reject){
    let labels = new Map([['',0]]);
    let rows;
    let ridx = 0;
    let gzipped = fname.endsWith('.gz');
    try {
      if(max>0){
        rows = new Array(max);
      } else {
        //estimate 39 bytes per row uncompressed, 1.2 per row compressed
        //preallocation was faster in testing
        rows = new Array(Math.ceil(fs.statSync(fname).size/(gzipped?1.2:39)));
      }
    } catch (e){
      return reject(e)
    }

    //gzip reading from:
    // https://stackoverflow.com/questions/38074288/read-gzip-stream-line-by-line
    var rs = fs.createReadStream(fname);
    var rl = readline.createInterface({
      input: gzipped?rs.pipe(zlib.createGunzip()):rs
    });
    let open = true;
    rl.on('line', function(line){
      if(max==0 || ridx<max){
        //147.32.84.180 86.126.40.27   1063 3128
        let idx = 0;
        let space = false;
        let row = new Array(6).fill('');
        for(c of line){
          if(c == ','){
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
        row[4] = +row[4];
        let label = row[5];
        if(label == no_label){
          label = '';
        }
        if(!labels.has(label)){
          labels.set(label,1<<(labels.size -1));
        }
        row[5] = labels.get(label);
        rows[ridx++] = row;
      } else {
        if(max>0 && open){
          open = false;
          rl.close();
        }
      }
    }).on('close',_=>{rows.length=ridx; // truncate if overallocated
                      resolve([rows,Array.from(labels.keys()).splice(1)])})
  })};

