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

  let nethasher = function(config){
    this.config = config;
    if(this.config.valuemap instanceof Map) {
      this.config.valuemap = Array.from(this.config.valuemap);
    }
    // "known" is typically used for services loaded from
    //  /etc/services It maps port numbers to an ID other than
    //  the portnumber itself
    let known =  new Map(config.valuemap);

    //todo: re-evaluate the necessity of the sorting;
    //to be safe, order the inputvalues here
    let pl = Array.from((config.inputvalues || [] ));
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

  nethasher.getBucketCount = _ => bcount;
  nethasher.prototype = {
    serializeForPorts: function(portSet){
      return {only: this.only,
              valuemap: Array.from(this.known).filter(([p,i])=>portSet.has(p))}
    },
    getBucketCount: nethasher.getBucketCount,
    toString: function(){
      return JSON.stringify(
        this.toJSON())},
    toJSON: function(){
      return this.config;
    },
    hash: phash,
    backhash: function(h, acceptableSet){
      /* There are two approaches possible for backhash:
         1. The origninal approach was to generate a list of all
            values (up to a limit) that hash to the target "h".
            This worked fine for port numbers (max=2**16), but
            failed for IPs (max=2**32).
         2. The second approach is to start with a set of values
            and filter them by their hash outcome being equal
            to "h". This approach fits how backhash has been used
            so far; all call sites filtered the backhash output
            using a set membership test.
      */

      let list = (this.knownback.has(h)?
                  Array.from(this.knownback.get(h)):
                  []).filter(v=>acceptableSet.has(v));

      if(! this.only){
        for(v of acceptableSet){
          if((!this.known.has(v)) && this.hash(v) == h){
            list.push(v);
          }
        }
      }


      /* This is a much simpler version that should be evaluated for performance:
      let list = [];

      for(v of acceptableSet){
        if(this.hash(v) == h){
          list.push(v);
        }
      }*/
      list.sort((a,b)=>(a-b)); //it would be faster to do insertion correctly
      return list;
    },
    //TODO: convert the old backhash function into something usable with
    //      the iteration protocol
    old_backhash: function(h,max){
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
        max = 2**32;//2**16;
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

  root.nethasher=nethasher;

})()
