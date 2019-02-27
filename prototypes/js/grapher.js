(function(){
    var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);

  let bcount = 256;
  /*let matrix = Array.from({length:bcount},
                          (x,i)=>Array.from({length:bcount},_=>0));
  let maxv = 0;
  let fields = new Map(
    [['udp.srcport','sport'],
     ['udp.dstport','dport'],
     ['tcp.srcport','sport'],
     ['tcp.dstport','dport']]);
  for(let rec of IMPORT_DATA.get('pcap')){
    let d = {};
    let r = rec._source.layers;
    fields.forEach(function(v,k) {
      if(typeof r[k] !== 'undefined'){
        d[v]=porthasher(r[k]);
      }
    });
    //console.log(d);
    matrix[d.sport][d.dport]++;
    maxv = Math.max(matrix[d.sport][d.dport],maxv);
  }

  let plotrix=new Array(bcount*bcount);
  for(let x = 0;x<bcount;x++){
    for(let y = 0;y<bcount;y++){
      plotrix[y*256+x]={x:x,y:y,z:matrix[y][x]};
    }
    }*/
  let plotrix = importData('pmatrix');


  // first watch for any existing load events
  let oldload = null;
  if(window.onload){
    oldload=window.onload;
  }

  function callxy(f){
    return {x:f("x"),y:f("y")}
  }

  //here's the setup: try to play nice with exisiting onLoads, if any
  window.onload = function(){
    if(typeof(oldload) == 'function'){
      oldload.apply(this,arguments);
    }

    let WIDTH = 600;
    let HEIGHT = 600;

    var SIZES = {x:WIDTH, y:HEIGHT};

    let svg = d3.select("body")
        .append("svg")
        .attr("width",WIDTH)
        .attr("height",HEIGHT);


    // distinct paddings -- to leave room for title, labels, and legend
    let PADDINGS = {left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0}

    // pre-calculating common padding operations
    PADDINGS.x = PADDINGS.left + PADDINGS.right;
    PADDINGS.y = PADDINGS.top + PADDINGS.bottom;
    PADDINGS.a = {x: PADDINGS.left, y: PADDINGS.top};
    PADDINGS.b = {x: PADDINGS.right, y: PADDINGS.bottom};

    let squareSideMax = callxy(xy=>(SIZES[xy]-PADDINGS[xy])/
                               (bcount+1));

    let squareSide = Math.min(squareSideMax.x,squareSideMax.y);

    let scales = callxy(xy => d3.scaleLinear()
                        .domain([0,bcount+1])
                        .range([PADDINGS.a[xy],
                                squareSide * (bcount+1)
                                + PADDINGS.a[xy]]));
    let UNIT_SIZE = {
      x: scales.x(1)-scales.x(0), //~=squareSide
      y: scales.y(1)-scales.y(0)  //~=squareSide
    };




    scales.z = d3.scaleLog()
      .domain([1,d3.max(plotrix)])
      .range([0,1]);

    let gapf = 1;//0.03;
    let rf = 1;//0.08;

    svg.selectAll("rect.plot")
      .data(plotrix)
      .enter()
      .append("rect")
      .classed("plot",true)
      .attr("width",UNIT_SIZE.x*(gapf))
      .attr("height",UNIT_SIZE.y*(gapf))
      .attr("x",(d,i)=>scales.x(Math.floor(i / bcount))+UNIT_SIZE.x*(gapf/2))
      .attr("y",(d,i)=>scales.y(i % bcount)+UNIT_SIZE.y*(gapf/2))
      .attr("fill",d=>d==0?'white':d3.interpolateYlOrBr(scales.z(d)))
      .attr("d",d=>d);
    };
  })();
