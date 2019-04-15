const FlowParser = require('../lib/pcsd');
let lines = ['1.2.3.4,4.3.5.4,30245,80,234,ok,hq1',
             '4.3.5.4,1.2.3.4,80,30245,1087,ok,hs1',
             '2.2.3.4,4.3.5.4,53,80,234,dos,dh1',
             '2.2.3.4,4.3.5.4,53,80,234,dos,dh2',
             '2.2.3.4,4.3.5.4,53,80,234,dos,dh3'];
let prom = FlowParser.flowsFromStrings(lines,{no_label:'ok'});
prom.then(([rows,labels])=>console.log({rows: rows,labels: labels}),
          e=>console.log({err:e}));
