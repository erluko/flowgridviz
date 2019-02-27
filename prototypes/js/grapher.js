(function(){
  matrix = Array.from({length:256},(x,i)=>Array.from({length:256},_=>0));
  let fields = new Map(
    [['udp.srcport','sport'],
     ['udp.dstport','dport'],
     ['tcp.srcport','sport'],
     ['tcp.dstport','dport']]);
  for(let rec of IMPORT_DATA.get('pcap')){
    let d = {};
    let r = rec._source.layers;
    fields.forEach(function(v,k) {
      if(typeof r[k] !== 'undefined'){
        d[v]=porthasher(r[k]);
      }
    });
    //console.log(d);
    matrix[d.sport][d.dport]++;
  }
})();
