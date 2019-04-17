#!/usr/bin/env node

console.log("Signatures over digest auth aren't working in the requests library")
process.exit(1)

var fs = require('fs');

function usage(){
  console.log(`
USAGE:
apitool.js keyid:path/to/key check BASE_URL
apitool.js keyid:path/to/key reload URL
apitool.js keyid:path/to/key update URL JSON
apitool.js keyid:path/to/key delete URL
`);
  process.exit(1);
}

if(process.argv.length<5 ||
   process.argv[2] == '-h' ||
   process.argv[2] == '--help' ){
  usage();
}

let [keyid,keyfilepath] = process.argv[2].split(':');
let action = process.argv[3];

if(action == 'update' && process.argv.length<6){
  usage();
}

let url = process.argv[4]

var key = fs.readFileSync(keyfilepath, 'ascii');


const request = require('request').defaults({
  httpSignature: {
    key: key,
    keyId: keyid,
    headers: ['date','digest']
  }
});

let acts={
  check:  (x)=> request.post(url+'/auth_check',x),
  reload: (x)=> request.post(url+'/reload',x),
  delete: (x)=> request.delete(url,x),
  update: (x)=> request.put(url,x)
};

let act = acts[action];
if(act){
  let httpStream = act(function (error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    console.log('body:', body); // Print the body
  });
} else {
  usage();
}
