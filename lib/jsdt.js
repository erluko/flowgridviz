/* JavaScript Dom (jsdom) Templates A minimal non-template library
   that uses DOM manipulation to avoid many common injection pitfals,
   including many that could lead to XSS.  It is inspired by:
   https://github.com/AndersDJohnson/express-views-dom but it runs on
   modern node and jsdom

   USAGE
   =====

   let options = {cache: new LRU(30)}; // entirely optional

   app.engine('html',require('./lib/jsdt')(options));
   app.set('view engine', 'html');

   app.get('/my/path', function(req, res){

   // read views/tempate_file.html, invoke callback with parsed
   // DOM's Window object:
   res.render('template_file',{
    key: "some_key", //cache key, optional

    // invoked if cache does not contain key
    render: function(window) {
      // do DOM manipulation on "window" here
      // return nothing. dom will be serialized and sent to res
    }})


    Options are:
    cache: an optional cache

    key: cache key to use for output

    fromString: string to use as dom basis instead of filename

    fromNew: if defined, start with a new blank DOM. The DOM will
    inlude html, head, and body tags. See new JSDOM().

    If cache is not specified, caching is disabled even in the
    presence of a key

    If key is not specified, cache will not be consulted

    fromNew and fromString are mutually exclusive. If both are
    specified, fromString overrides fromNew

    NOTE: express's res.render() demands that the file name argument
    refers to an actual file, even if using fromNew or fromString.
*/

const fs = require("fs");
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
    let fromFile = !(options.fromString || options.fromNew);
    let lastUpdate = 0;
    if(fromFile){
      try{
        lastUpdate = fs.statSync(filename).mtimeMs;
      } catch(e){
        //do nothing. Treat lastUpdate as 0;
      }
    }

    if(options.key &&
       config.cache.has(options.key)){
      let entry = config.cache.get(options.key);
      if(entry.cacheTime >= lastUpdate){
        return callback(null,entry.value);
      }
    }

    let jdo = Promise.resolve(
      options.fromString?
        new JSDOM(options.fromString):
        options.fromNew?
        new JSDOM():
        JSDOM.fromFile(filename));
    jdo.then(dom => {
      options = options || (options = { render: _ => null});
      options.render(dom.window);
      let output = dom.serialize();
      dom.window.close();
      if(options.key){
        config.cache.set(options.key,{value: output,
                                      cacheTime: new Date().getTime(),
                                      fileName: filename});
      }
      return callback(null, output);
    }, err => callback(err) );
  }
}
