const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let DummyCache = function(){};

DummyCache.prototype={
  key: null,
  val: null,
  set: function(k,v){
    this.key = k;
    this.val = v;
  },
  get: function(k){
    let ret = k == key?val:null;
    key = null;
    val = null;
    return ret;
  }
}

module.exports = function(config){
  config = config || (config = {cache: new DummyCache() });
  return function (filename, options, callback) {
    if(options.key && config.cache.has(options.key)){
      return config.cache.get(options.key);
    } else {
      JSDOM.fromFile(filename).then(dom => {
        options = options || (options = { render: _ => null});
        options.render(dom.window);
        let output = dom.serialize();
        dom.window.close();
        if(options.key){
          config.cache.set(options.key,output);
        }
        callback(null, output);
      }, err => callback(err) );
    }
  }
}
