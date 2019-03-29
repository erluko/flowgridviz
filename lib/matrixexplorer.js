(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

  root.getMatrix = function(ph,stype,dtype,data){
    //data: [[sip,dip,sport,dport],...]
    //ips are in int form
    //TODO: accept an IP hasher and port hasher
    //TODO: support X or Y being IP or Port

    let bcount = ph.getBucketCount();
    let matrix = new Map();
    let sources = new Set();
    let dests = new Set();
    for(let row of data){
      //FIXME: change [2] [3] to something based on stype/dtype
      let sph = ph.hash(+row[2]);
      let dph = ph.hash(+row[3]);
      let idx = sph * bcount + dph;
      let v = matrix.get(idx) || 0;
      matrix.set(idx,v+1);
      //FIXME: change [2] [3] to something based on stype/dtype
      sources.add(+row[2]);
      dests.add(+row[3]);
    }
    return  {
      matrix: Array.from(matrix),
      sources: Array.from(sources).sort((a,b)=>a-b),
      dests: Array.from(dests).sort((a,b)=>a-b),
      // FIXME: serialize for ports or ips
      hashconfig: ph.serializeForPorts(new Set(Array.from(sources)
                                               .concat(Array.from(dests))))
    };
  }

  root.cd = function (m,[axes,idx]){
    let [xvs,yvs] = m.withAxes(axes).backhash(idx);
    return data.select(axes[0],xvs,axes[1],yvy)
  }
})();


