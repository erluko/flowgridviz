(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);

  let bcount = 256;
  let bigp = 4295012789;
  let lilp = 4295021
  let bpm = bigp % bcount;
  let lpm = lilp % bcount;

  //get multiplicative inverse of pbm
  let bdp = Array.from({length:bcount},(x,i)=>(bpm*i%bcount==1?i:0)).filter(x=>x)[0];

  let known = (function (){ // list of known services from /etc/services
    let ret = new Map();
    let data = new Map(importData('services'));
    let snames = Array.from(new Set(data.values()));
    let smap = new Map();
    snames.sort().forEach((n,i)=>smap.set(n,i))
    data.forEach((v,k) => ret.set(k,smap.get(v)));
    return ret;
  })();
  let maxknown = Math.max.apply(null,Array.from(known.keys()));

  /* distribution check:
     Array.from({length:2**16},(x,i)=>porthash(i)).reduce(function(a,x,i){if(!a[x]){a[x]=[];}a[x].push(i); return a},[]).map(x=>x.length).reduce((a,b)=>((a[''+b]=(a[''+b]?a[''+b]+1:1)),a),{})

     Results:
     253: 10
     254: 18
     255: 53
     256: 80
     257: 71
     258: 24

     Meaning, 10 buckets had 253 values, 18 had 254, 53 had 255 ...
     The expected value for a perectly random hash would be 256 entries
     of length 256 in a set of 2**16. Only 81 had fewer and 95 had more,
     indicating a close clustering around 256 despite having altered the
     outcomes for known services.
  */
  let simphash = function(p) {
    return ((p + lpm) * bpm) % bcount;
    // == ((p*bpm % bcount) +  lpm * bpm) % bcount
    // == ((p % bcount * bpm) +  lpm * bpm) % bcount
  }
  root.porthash = function(p){
    if(known.has(p)){
      return (known.get(p) + bpm) % bcount;
    } else {
      return simphash(p);
    }
  }

  let knownback = new Map();
  known.forEach(function(v,k){
    let h = root.porthash(v);
    knownback.has(h)?knownback.get(h).push(k):knownback.set(h,[k])
  });

  root.backhash = function(h,max=2**16){
    let list = (knownback.has(h)?Array.from(knownback.get(h)):[]).filter(x=>x<max);
    //P == h * bdp % bcount + bcount - lpm |!known(P)
    let start = h * bdp % bcount + bcount - lpm;

    if(start > max){
      return list;
    }

    for(p=start;p<=max;p+=256){
      if(!known.has(p)){
        list.push(p);
      }
    }

    list.sort((a,b)=>(a-b)); //it would be faster to do insertion correctly
    return list;
  }
})()
