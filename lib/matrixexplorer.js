(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

  root.getMatrix = function(ph,data){
    //data: [[sip,dip,sport,dport],...]
    //ips are in int form
    //TODO: accept an IP hasher and port hasher
    //TODO: support X or Y being IP or Port

    let bcount = ph.getBucketCount();
    let matrix = new Map();
    let sports = new Set();
    let dports = new Set();
    for(let row of data){
      let sph = ph.hash(+row[2]);
      let dph = ph.hash(+row[3]);
      let idx = sph * bcount + dph;
      let v = matrix.get(idx) || 0;
      matrix.set(idx,v+1);
      sports.add(+row[2]);
      dports.add(+row[3]);
    }
    return  {
      matrix: Array.from(matrix),
      sports: Array.from(sports).sort((a,b)=>a-b),
      dports: Array.from(dports).sort((a,b)=>a-b),
      hashconfig: ph.serializeForPorts(new Set(Array.from(sports)
                                               .concat(Array.from(dports))))
    };
  }

  root.cd = function (m,[axes,idx]){
    let [xvs,yvs] = m.withAxes(axes).backhash(idx);
    return data.select(axes[0],xvs,axes[1],yvy)
  }
})();


