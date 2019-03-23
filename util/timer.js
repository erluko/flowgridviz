let startTime=new Date().getTime();
require('./lib/pcsd')
  .fromFile(process.argv[2])
  .then(function(p){
    let readyTime = new Date().getTime();
    let elapsedSecs = ((readyTime - startTime)/1000).toFixed(3);
    console.log(`Loaded ${p.length} packets in ${elapsedSecs} seconds.`);
  })
