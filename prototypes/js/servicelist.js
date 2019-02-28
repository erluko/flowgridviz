(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);

    root.servicemap=(function (){ // list of known services from /etc/services
    let ret = new Map();
    let data = new Map(importData('services'));
    let snames = Array.from(new Set(data.values()));
    let smap = new Map();
    snames.sort().forEach((n,i)=>smap.set(n,i))
    data.forEach((v,k) => ret.set(k,smap.get(v)));
    return ret;
  })();
})()
