/* todo: consider defining subgraphs as a series of triples:
      (i|p,i|p,idx) instead of sources and destingations
      this takes us from:
         /subgraph?sports=1110,1366,...&dports=1177,1433,...
      to:
         /pp54/pi234/ip3423/ii743
      which says to first get idx=54 in a port/port matrix, then
      idx=234 in the resulting port/ip matrix, then idx=2423 in
      an ip/port view of that result, then finally to render the 743rd
      element of an ip/ip view of that matrix.

      What axes should be used for the last one? Not sure. Maybe use
      the pi|pp|ip|ii pairs as a final dir entry?
         e.g. /pp/54/pi/234/ip/3423/ii/743/pp to view the last
         matrix as a port/port view by default?
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

    let bcount = 256; //TODO: perhaps get from ph
    let matrix = new Array(bcount ** 2).fill(0);
    let sports = new Set();
    let dports = new Set();
    for(let row of data){
      let sph = ph.hash(+row[2]);
      let dph = ph.hash(+row[3]);
      matrix[sph * bcount + dph]++;
      //console.log([row[2],row[3],sph,dph,sph*bcount+dph]);
      sports.add(+row[2]);
      dports.add(+row[3]);
    }
    return  {
      matrix: matrix,
      sports: Array.from(sports).sort((a,b)=>a-b),
      dports: Array.from(dports).sort((a,b)=>a-b)
    };
  }

  root.cd = function (m,[axes,idx]){
    let [xvs,yvs] = m.withAxes(axes).backhash(idx);
    return data.select(axes[0],xvs,axes[1],yvy)
  }
})();


