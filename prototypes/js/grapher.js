(function(){
  let bcount = 256;
  let matrix = Array.from({length:bcount},
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
  }


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

    let gradations = 20;
    let colors = new Array(gradations);
    for(let t=0; t<1; t+=1/gradations){
      colors.push(d3.interpolateOranges(maxv));
    }

    scales.z = d3.scaleQuantize()
      .domain([0,maxv])
        .range(colors);


    let gapf = 2;//0.03;
    let rf = 0;//0.08;

    svg.selectAll("rect.plot")
      .data(plotrix)
      .enter()
      .append("rect")
      .classed("plot",true)
      .attr("width",UNIT_SIZE.x*(gapf))
      .attr("height",UNIT_SIZE.y*(gapf))
      .attr("x",d=>scales.x(d.x)+UNIT_SIZE.x*(gapf/2))
      .attr("y",d=>scales.y(d.y)+UNIT_SIZE.y*(gapf/2))
      .attr("fill",d=>scales.z(d.z));
    };
  })();
