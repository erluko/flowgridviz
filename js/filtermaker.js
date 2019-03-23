(function(){
  var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:(this.filtermaker={});

  root.tsDisplayFilter = function(sports,dports) {
    sports = Array.from(sports);
    dports = Array.from(dports);
    return "(" +
      sports.map(p=>'tcp.srcport == '+p + ' or udp.srcport == ' +p ).join(' or ') +
      ') and (' +
      dports.map(p=>'tcp.dstport == '+p + ' or udp.dstport == ' +p ).join(' or ') +
      ')';
  }
})()
