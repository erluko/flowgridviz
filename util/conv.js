#!/usr/bin/env node

let readline = require('readline');
let fs = require('fs');
const zlib = require('zlib');

let input = process.stdin;

if(process.argv.length>=3){
  let ifname = process.argv[2];
  if(ifname != '-'){
    let gzipped = ifname.endsWith('.gz');
    let rs = fs.createReadStream(ifname);
    input = gzipped?rs.pipe(zlib.createGunzip()):rs
  }
}

let output = process.stdout; //todo eventually add gzipped output support

let cols = ['Src IP','Dst IP','Src Port','Dst Port','Tot Fwd Pkts','Label','Flow ID']
let rl = readline.createInterface({
  input: input
});
let colidx;
let headers = null;
rl.on('line', function(line){
  let parts = line.split(',');
  if(headers == null){
    headers = new Map(parts.map((k,i)=>[k,i]));
    colidx = cols.map(k=>headers.get(k));
  } else {
    let comma = '';
    for(let i of colidx){
      output.write(comma+parts[i]);
      comma = ',';
    }
    output.write("\n");
  }
})
