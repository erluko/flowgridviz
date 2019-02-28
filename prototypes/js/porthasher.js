(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;

  let bcount = 256;
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

  let porthasher = function(){
    this.from.apply(this,arguments);
  }

  let getKnownBack = function(){
    if(typeof this.knownback == 'undefined'){
      this.knownback = new Map();
      this.known.forEach(function(v,k){
        let h = this.hash(v);
        this.knownback.has(h)?
          this.knownback.get(h).push(k):
          this.knownback.set(h,[k])
      });
    }
    return this.knownback;
  }
  porthasher.prototype = {
    hash: function(p){
      if(this.known.has(p)){
        return (this.known.get(p) + bpm) % bcount;
      } else {
        return simphash(p);
      }
    },
    backhash: function(h,max=2**16){//todo get max from list
      getKnownBack.call(this);
      let list = (this.knownback.has(h)?
                  Array.from(this.knownback.get(h)):
                  []).filter(x=>x<max);

      //P == h * bdp % bcount + bcount - lpm |!known(P)
      let start = h * bdp % bcount + bcount - lpm;

      if(start > max){
        return list;
      }

      for(p=start;p<=max;p+=256){
        if(!this.known.has(p)){
          list.push(p);
        }
      }

      list.sort((a,b)=>(a-b)); //it would be faster to do insertion correctly
      return list;
    },
    from: function(config={}){
      //todo accept config.portlist
      this.known =  config.portmap || new Map();
    }
  }

  root.porthasher=porthasher;

})()
