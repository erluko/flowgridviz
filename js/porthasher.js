(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

  const bcount = 53;
  let bigp = 4295012789;
  let lilp = 4295021
  let bpm = bigp % bcount;
  let lpm = lilp % bcount;

  //get multiplicative inverse of pbm
  let bdp = Array.from({length:bcount},(x,i)=>(bpm*i%bcount==1?i:0)).filter(x=>x)[0];

  let simphash = function(p) {
    return ((p + lpm) * bpm) % bcount;
    // == ((p*bpm % bcount) +  lpm * bpm) % bcount
    // == ((p % bcount * bpm) +  lpm * bpm) % bcount
  }

  let phash = function(p){
    if(this.known.has(p)){
      return (this.known.get(p) + bpm) % bcount;
    } else {
      return simphash(p);
    }
  }

  let porthasher = function(config){
    this.config = config;
    if(this.config.portmap instanceof Map) {
      this.config.portmap = Array.from(this.config.portmap);
    }
    // "known" is typically used for services loaded from
    //  /etc/services It maps port numbers to an ID other than
    //  the portnumber itself
    let known =  new Map(config.portmap);

    //todo: re-evaluate the necessity of the sorting;
    //to be safe, order the portlist here
    let pl = Array.from((config.portlist || [] ));
    pl.sort((a,b)=>a-b);
    pl.forEach((p,i) => known.set(p,i));

    let knownback = new Map();
    // the use of 'call' bellow is a major hack
    known.forEach(function(v,k){
      let h = phash.call({known: known},k);
      knownback.has(h)?
          knownback.get(h).push(k):
        knownback.set(h,[k])
    });
    // since knownback will enforce only we don't need:
    // thisonly = new Set(known.keys())
    this.only = config.only;
    this.known = known;
    this.knownback = knownback;
  }

  porthasher.getBucketCount = _ => bcount;
  porthasher.prototype = {
    getBucketCount: porthasher.getBucketCount,
    toString: function(){
      return JSON.stringify(
        this.toJSON())},
    toJSON: function(){
      return this.config;
    },
    hash: phash,
    backhash: function(h,max){
      let list = (this.knownback.has(h)?
                  Array.from(this.knownback.get(h)):
                  []);

      if(typeof max !== 'undefined'){
        list = list.filter(x=>x<=max);
      }

      if(this.only){
        return list;
      }

      if(typeof max == 'undefined'){
        max = 2**16;
        list = list.filter(x=>x<=max);
      }

      //P == h * bdp % bcount + bcount - lpm |!known(P)
      let start = (h * bdp % bcount + bcount - lpm) % bcount;

      if(start > max){
        return list;
      }

      for(p=start;p<=max;p+=bcount){
        if(!this.known.has(p)){
          list.push(p);
        }
      }

      list.sort((a,b)=>(a-b)); //it would be faster to do insertion correctly
      return list;
    },
  }

  root.porthasher=porthasher;

})()
