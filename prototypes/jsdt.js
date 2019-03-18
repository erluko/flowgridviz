const jsdom = require("jsdom");
const { JSDOM } = jsdom;

module.exports = function(config){
  config = config || (config = {});
  return function (filename, options, callback) {
    JSDOM.fromFile(filename+"fred").then(dom => {
      options = options || (options = { render: _ => null});
      options.render(dom.window);
      callback(null, dom.serialize());
      dom.window.close();
    }, err => callback(err) );
  }
}
