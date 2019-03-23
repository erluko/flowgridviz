 /* Subgraphs are defined as a series of triples: (i|p,i|p,idx)
    expressed as a path: /(i|p)(ip)/idx/...
    e.g.  /pp/54/pi/234/ip/3423/ii/743
    which says to first get idx=54 in a port/port matrix, then
    idx=234 in the resulting port/ip matrix, then idx=2423 in
    an ip/port view of that result, then finally to render the 743rd
    element of an ip/ip view of that matrix.

    What axes should be used for the last one? See the last path
    element. If it is a number, the axes will be port/port. If it
    is one of the pi|pp|ip|ii pairs, the axes expressed will be used.
 */
(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  root.pathParser = function (s){
    let instr = s.split('/')
        .filter(g => g.length > 0)
        .map((p,i)=>i%2?
             (/^\d+$/.test(p)?+p:null):
             (/^[pi]{2}$/.test(p)?Array.from(p):null));
    return instr.includes(null)?[]:(instr.length%2?instr.concat(null):instr).reduce(
      (a,b,i)=>((i%2?a[0]=[a[0],b]:a.unshift(b)),a),[]).reverse();
  }

  root.getMatrix = function(ph,data){
    //data: [[sip,dip,sport,dport],...]
    //ips are in int form
    //TODO: accept an IP hasher and port hasher
    //TODO: support X or Y being IP or Port

    let bcount = ph.bcount;
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
      hashconfig: ph.config
    };
  }

  root.cd = function (m,[axes,idx]){
    let [xvs,yvs] = m.withAxes(axes).backhash(idx);
    return data.select(axes[0],xvs,axes[1],yvy)
  }
})();


