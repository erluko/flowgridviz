/* builds tshark filter strings out of data from the structure retrieved for a
   particular matrix path */
(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:(this.filtermaker={});
  root.tsDisplayFilter = function(sources,dests,stype,dtype) {
    sources = Array.from(sources);
    dests = Array.from(dests);
    'ip.src in {147.32.84.180 60.190.222.139}'
    let typefns = {
      /* port */ p: dir => function(ps){
        let pss = ps.join(' ');
        return 'tcp.'+dir+'port in {'+pss+'} or udp.'+dir+'port in {'+pss+'}';
      },
      /* ip */ i: dir => is => 'ip.'+dir+' in {'+is.join(' ')+'}'
    };
    // Apply function based on src/dest types
    let sfn = typefns[stype]('src');
    let dfn = typefns[dtype]('dst');
    return "(" +
      sfn(sources) +
      ') and (' +
      dfn(dests) +
      ')';
  }
})()
