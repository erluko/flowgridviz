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
  }

  let phash = function(p){
    return simphash(this.valuemap.get(p) || p);
  }

  let nethasher = function(valuemap){
    if(typeof valuemap === 'undefined') {
      valuemap = [];
    }

    if(!(valuemap instanceof Map)) {
      valuemap = new Map(valuemap);
    }
    this.valuemap = valuemap;
  }

  nethasher.getBucketCount= _ => bcount;

  nethasher.prototype = {
    serializeForValues: function(valueSet){
      let vm = [];
      for(v of valueSet){
        if(this.valuemap.has(v)){
          vm.push([v,this.valuemap.get(v)]);
        } else {
          let h = simphash(v);
          let bh = (h * bdp % bcount + bcount - lpm) % bcount;
          vm.push([v,bh]);
        }
      }
      return vm;
    },
    getBucketCount: nethasher.getBucketCount,
    toString: function(){
      return JSON.stringify(
        this.toJSON())},
    toJSON: function(){
      return this.valuemap;
    },
    hash: phash,
    backhash: function(h, acceptableSet){
      let list = [];
      for(v of acceptableSet){
        if(this.hash(v) == h){
          list.push(v);
        }
      }
      return list;
    },
  }

  root.nethasher=nethasher;

})()
