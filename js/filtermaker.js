(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:(this.filtermaker={});
  //FIXME: assumes sources and dests are ports
  root.tsDisplayFilter = function(sports,dports,stype,dtype) {
    sports = Array.from(sports);
    dports = Array.from(dports);
    return "(" +
      sports.map(p=>'tcp.srcport == '+p + ' or udp.srcport == ' +p ).join(' or ') +
      ') and (' +
      dports.map(p=>'tcp.dstport == '+p + ' or udp.dstport == ' +p ).join(' or ') +
      ')';
  }
})()
