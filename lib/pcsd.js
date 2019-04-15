const readline = require('readline');
const fs = require('fs');
const zlib = require('zlib');
const request = require('request');
const Stream = require('stream');

function ipStrToInt(s){
  // ">>>0" thanks to http://2ality.com/2012/02/js-integers.html
  let octets = s.split('.');
  return (octets[0]<<24 | octets[1] <<16 | octets[2]<<8 |octets[3] )>>>0;
}


function FlowParser(stream,options){
  this.max = options?options.max||0:0;
  this.no_label = options?(options.no_label || 'No Label'): 'No Label';
  this.labels = new Map([['',0]]);
  this.rows = this.max>0?new Array(this.max):[];
  this.prom = parseStream(this,stream);
}

let parseLine =  function (fp,line){
  let idx = 0;
  let space = false;
  let row = new Array(7).fill('');
  for(c of line){
    if(idx>=row.length) break;
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
  if(label == fp.no_label){
    label = '';
  }
  if(!fp.labels.has(label)){
    fp.labels.set(label,1<<(fp.labels.size -1));
  }
  row[5] = fp.labels.get(label);
  return row;
}

let parseStream = function(fp,input){
  return new Promise(function(resolve,reject){
    input.on('error', (err) => reject(err));
    var rl = readline.createInterface({input: input });
    let open = true;
    let ridx = 0;
    rl.on('line', function(line){
      if(fp.max==0 || ridx<fp.max){
        fp.rows[ridx++] = parseLine(fp,line);
      } else {
        if(fp.max>0 && open){
          open = false;
          rl.close();
        }
      }
    }).on('close',_=>{fp.rows.length=ridx; // truncate if overallocated
                      resolve([fp.rows,Array.from(fp.labels.keys()).splice(1)])})
  });
}


FlowParser.flowsFromFile = function(fname,options){
  let gzipped = fname.endsWith('.gz');
  let rs = fs.createReadStream(fname);
  //gzip reading from:
  // https://stackoverflow.com/questions/38074288/read-gzip-stream-line-by-line
  return (new FlowParser(gzipped?rs.pipe(zlib.createGunzip()):rs,options)).prom;
}

FlowParser.flowsFromUrl = function(url,options){
  //http reading is from:
  //https://mcculloughwebservices.com/2017/10/12/nodejs-request-file-parsing-readline/
  let httpStream = request.get(url);
  return (new FlowParser(httpStream,options)).prom;
}

FlowParser.flowsFromString = function(s,options){
  return FlowParser.fromStrings(s.split('\n'),options);
}

FlowParser.flowsFromStrings = function(sl,options){
  //string array stream design from:
  //https://stackoverflow.com/questions/16848972/how-to-emit-pipe-array-values-as-a-readable-stream-in-node-js
  const readable = new Stream.Readable()
  ip = new FlowParser(readable,options);
  sl.forEach(line => readable.push(line + "\n"));
  readable.push(null);
  return ip.prom;
}

module.exports=FlowParser;
