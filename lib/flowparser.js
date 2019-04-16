const readline = require('readline');
const fs = require('fs');
const zlib = require('zlib');
const request = require('request');
const Stream = require('stream');

// Convert dotted-form IP addresses (1.2.3.4) into an int.
function ipStrToInt(s){
  // ">>>0" thanks to http://2ality.com/2012/02/js-integers.html
  let octets = s.split('.');
  return (octets[0]<<24 | octets[1] <<16 | octets[2]<<8 |octets[3] )>>>0;
}

// Constructor
function FlowParser(stream,options){
  this.max = options?options.max||0:0;
  this.no_label = options?(options.no_label || 'No Label'): 'No Label';
  this.labels = new Map([['',0]]);
  this.rows = this.max>0?new Array(this.max):[];
  this.prom = parseStream(this,stream);
}

/* Parse a single line of input, adding it to the flow/packet list, and
   update the set of known labels */
let parseLine =  function (fp,line){
  let idx = 0;
  let space = false;
  /* Columns are src-ip,dest-ip,src-port,dest-port,weight,label,id
     Only the first four are reuqired.
  */
  let row = new Array(7).fill('');
  for(c of line){
    if(idx>=row.length) break;
    if(c == ','){
      //FIXME: this used to be space-delimited, the variable name is bad
      if(!space){
        space = true;
        idx++;
      }
    } else {
      space = false;
      row[idx]+=c;
    }
  }
  row[0] = ipStrToInt(row[0]);  // source IP address
  row[1] = ipStrToInt(row[1]);  // destination IP address
  row[2] = +row[2];             // source port number
  row[3] = +row[3];             // destination port number
  row[4] = +row[4];             // weight (usually 1 or the flow packet count)
  let label = row[5];
  // ignore the "no_label" label
  if(label == fp.no_label){
    label = '';
  }
  if(!fp.labels.has(label)){
    // assign the label an ID bit
    fp.labels.set(label,1<<(fp.labels.size -1));
  }
  row[5] = fp.labels.get(label);// label as a bit field
  // no specific assignment for [6] (id)
  return row;
}

// Convert a stream into a fully populated set of records and labels
let parseStream = function(fp,input){
  return new Promise(function(resolve,reject){
    input.on('error', (err) => reject(err));
    var rl = readline.createInterface({input: input });
    let open = true;
    let ridx = 0;
    rl.on('line', function(line){
      if(fp.max==0 || ridx<fp.max){
        // parse one line
        if(ridx == 0 && (line[0]>'9' || line[0]<'0')){
          // skip header if present
        } else {
          fp.rows[ridx++] = parseLine(fp,line);
        }
      } else {
        if(fp.max>0 && open){
          // stop when input stops or max is reached
          open = false;
          rl.close();
        }
      }
    }).on('close',_=>{fp.rows.length=ridx; // truncate if overallocated
                      // ditch the first label (the "no_label" label):
                      resolve([fp.rows,Array.from(fp.labels.keys()).splice(1)])})
  });
}


/* Utility function to return a promise representing the flows or
   packets parsed from the contents of a local file on disk */
FlowParser.flowsFromFile = function(fname,options){
  return new Promise(function(resolve,reject){
    let rs = fs.createReadStream(fname).on('error',reject)
    if(fname.endsWith('.gz')) {
      //gzip reading from:
      // https://stackoverflow.com/questions/38074288/read-gzip-stream-line-by-line
      rs = rs.pipe(zlib.createGunzip()).on('error',reject)
    }
    new FlowParser(rs,options).prom.then(resolve,reject)
  });
}

/* Utility function to return a promise representing the flows or
   packets parsed from the contents of an http(s) response body */
FlowParser.flowsFromURL = function(url,options){
  //http reading is from:
  //https://mcculloughwebservices.com/2017/10/12/nodejs-request-file-parsing-readline/
  return new Promise(function(resolve,reject){
    let httpStream = request.get(url).on('error',reject);
    new FlowParser(httpStream,options).prom.then(resolve,reject)
  });
}

/* Utility function to return a promise representing the flows or
   packets parsed from a single string with internal newlines */
FlowParser.flowsFromString = function(s,options){
  return FlowParser.fromStrings(s.split('\n'),options);
}

/* Utility function to return a promise representing the flows or
   packets parsed from an array of strings, each row representing a line of text*/
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
