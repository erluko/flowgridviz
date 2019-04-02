#!/usr/bin/env node

var readline = require('readline');


let cols = ['Src IP','Dst IP','Src Port','Dst Port','Label','Flow ID']
let rl = readline.createInterface({
  input: process.stdin
});
let colidx;
let headers = null;
rl.on('line', function(line){
  let parts = line.split(',');
  if(headers == null){
    headers = new Map(parts.map((k,i)=>[k,i]));
    colidx = cols.map(k=>headers.get(k));
    console.log(colidx);
  } else {
    let comma = '';
    for(let i of colidx){
      process.stdout.write(comma+parts[i]);
      comma = ',';
    }
    process.stdout.write("\n");
  }
})
