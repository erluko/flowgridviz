(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

 /* idxsForTypes returns the list of indices into the columns of each record
       that represent the requested data.
       The native storage is as described in getMatrix, below.
       So for view 'pp' idxs = [2,3]
       and for view 'ip' idxs = [0,3] */
  let idxsForTypes = function(s,d){
    return [s=='p'?2:0,d=='p'?3:1]
  }
  root.idxsForTypes = idxsForTypes;

  /* Given a nethasher, a source type, a dest type, and a list of flows/packets,
     return an object containing the data needed to render the matrix */
  root.getMatrix = function(ph,stype,dtype,data){
    //data: [[sip,dip,sport,dport,weight*,label*,id*],...]
    //ips are in int form
    //weight is optional and defaults to 1
    //label is optional and is passed through unmodified
    //id is optional and is passed through unmodified

    let bcount = ph.getBucketCount();
    let matrix = new Map();
    let sources = new Set();
    let dests = new Set();
    let idxs = idxsForTypes(stype,dtype);
    for(let row of data){
      let s = +row[idxs[0]]; // source ip or port (based on stype)
      let d = +row[idxs[1]]; // dest ip or port (based on dtype)
      let w = row.length<5?1:(+row[4]||1); // weight
      let sph = ph.hash(s);  // hash value of source
      let dph = ph.hash(d);  // hash value of dest
      let idx = sph * bcount + dph; //linear index address for source & dest
      let [v,l] = matrix.get(idx) || [0,0]; // v=value, l=label
      matrix.set(idx,[v+w, l | row[5]]); // add weight, enable label bits
      sources.add(s);        // update source list
      dests.add(d);          // update dest list
    }
    // this structure is used in a number of ways, including by in-browser scripts
    return  {
      matrix: Array.from(matrix),
      stype: stype,
      dtype: dtype,
      sources: Array.from(sources).sort((a,b)=>a-b),
      dests: Array.from(dests).sort((a,b)=>a-b),
      // FIXME: getMatrix is called for intermediate results, don't serialize every time
      hashconfig: ph.serializeForValues(new Set(Array.from(sources)
                                                .concat(Array.from(dests))))
    };
  }
})();


