(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

  let idxsForTypes = function(s,d){
    return [s=='p'?2:0,d=='p'?3:1]
  }
  root.idxsForTypes = idxsForTypes;

  root.getMatrix = function(ph,stype,dtype,data){
    //data: [[sip,dip,sport,dport],...]
    //ips are in int form
    //TODO: accept an IP hasher and port hasher
    //TODO: support X or Y being IP or Port

    let bcount = ph.getBucketCount();
    let matrix = new Map();
    let sources = new Set();
    let dests = new Set();
    let idxs = idxsForTypes(stype,dtype);
    for(let row of data){
      let s = +row[idxs[0]];
      let d = +row[idxs[1]];
      let sph = ph.hash(s);
      let dph = ph.hash(d);
      let idx = sph * bcount + dph;
      let v = matrix.get(idx) || 0;
      matrix.set(idx,v+1);
      sources.add(s);
      dests.add(d);
    }
    return  {
      matrix: Array.from(matrix),
      stype: stype,
      dtype: dtype,
      sources: Array.from(sources).sort((a,b)=>a-b),
      dests: Array.from(dests).sort((a,b)=>a-b),
      // FIXME: serialize for ports or ips
      // FIXME: getMatrix is called for intermediate results, don't serialize every time
      hashconfig: ph.serializeForPorts(new Set(Array.from(sources)
                                               .concat(Array.from(dests))))
    };
  }
})();


