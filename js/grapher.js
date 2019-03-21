(function(){
    var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);


  let bcount = 256;
  pdata = importData('pmatrix');
  let sports = new Set(pdata.sports);
  let spmax = pdata.sports[pdata.sports.length-1];
  let dports = new Set(pdata.dports);
  let dpmax = pdata.dports[pdata.dports.length-1];
  let plotrix = pdata.matrix;

  let phr = inNode?require('porthasher.js'):{porthasher: root.porthasher};
  let ph = new phr.porthasher(pdata.hashconfig);

  // first watch for any existing load events
  let oldload = null;
  if(window.onload){
    oldload=window.onload;
  }

  function callxy(f){
    return {x:f("x"),y:f("y")}
  }

  /*
    makeVertical is to be called with selection.call() on a text
    node THAT DOES NOT HAVE x OR y SET
   */
  function makeVertical(s,x=0,y=0){
    let fx = typeof x == 'function'?x:(_=> x);
    let fy = typeof y == 'function'?y:(_=> y);

    return s
      .attr("style","writing-mode: tb")
      .attr("transform", (d,i) => "matrix(-1 0 0 -1 "
            + fx(d,i)
            + " "
            + fy(d,i)
            +")");
  }

  //here's the setup: try to play nice with exisiting onLoads, if any
  window.onload = function(){
    if(typeof(oldload) == 'function'){
      oldload.apply(this,arguments);
    }

    let body = d3.select("body");

    let bodywidth;
    try{
      bodywidth = +body.node().getBoundingClientRect().width;
    } catch(e){}
    if(isNaN(bodywidth)){
      bodywidth = +body.attr("width").replace(/px/,'');
    }
    if(isNaN(bodywidth)){
      bodywidth = +body.style("width").replace(/px/,'');
    }
    if(isNaN(bodywidth)){
      bodywidth = 700;
    }

    let WIDTH = bodywidth - 50;
    let HEIGHT = WIDTH;

    var SIZES = {x:WIDTH, y:HEIGHT};

    let svg = d3.select("svg")
        .attr("width",WIDTH)
        .attr("height",HEIGHT)

    // distinct paddings -- to leave room for title, labels, and legend
    let PADDINGS = {left: 40,
                    right: 0,
                    top: 0,
                    bottom: 30}

    // pre-calculating common padding operations
    PADDINGS.x = PADDINGS.left + PADDINGS.right;
    PADDINGS.y = PADDINGS.top + PADDINGS.bottom;
    PADDINGS.a = {x: PADDINGS.left, y: PADDINGS.top};
    PADDINGS.b = {x: PADDINGS.right, y: PADDINGS.bottom};


    svg.append("g")
      .classed("y-axis-label",true)
      .append("text")
      .call(makeVertical,PADDINGS.left-8,HEIGHT/2)
      .text("Source Port")

    svg.append("g")
      .classed("x-axis-label",true)
      .append("text")
      .attr("x",WIDTH/2)
      .attr("y",HEIGHT-PADDINGS.bottom+8)
      .text("Destination Port")

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

    /* Subgraphs are described in lib/matrixexplorer.js

       The implementation here takes the current path and links
       "index.html" in a virtual subdirectory whose relative
       "pmatrix.js" will contain the specfic matrix information for
       the selected index.
     */
    let subgraphURL = function(idx){
      let newpath='./'+idx+'/pp/index.html'
      if(window.location.pathname.startsWith('/index.html')){
        newpath = 'pp/'+newpath;
      }
      return newpath;
    }

    //todo: allow for src/dest to each be either ip or  port
    let portsForIndex = function(idx){
      let x = idx % bcount;
      let y = Math.floor(idx / bcount);
      let sps = ph.backhash(y,spmax).filter(p=>sports.has(p));
      let dps = ph.backhash(x,dpmax).filter(p=>dports.has(p));
      return [sps,dps];
    }

    let tip = d3.tip()
        .attr('class', 'port-tip')
        .html(function([c,idx]){
          if(c>0){
            let [sps,dps] = portsForIndex(idx);
            return "count: "+c+"<br/>from: "+sps.join(' ')+
              "<br/>to: "+dps.join(' ');
          } else {
            return "";
          }
        });

    svg.call(tip)
    function handleHover(mode,datum,index,nodes){
      if(mode){
        if(datum>0){
          tip.show([datum,index])
            .style("pointer-events","")//get from css
            .style("opacity","");//get from css
        }
      } else {
        tip.hide();
      }
    }

    let as = svg.selectAll("a.plot")
        .data(plotrix);

    // next line not needed unless changing node counts
    //as.exit().remove();

    as.enter()
      .append("a")
      .classed("plot",true)
      .merge(as)
      .each(function(d,idx){
        if(d>0){
          d3.select(this)
            .attr("xlink:href",() => subgraphURL(idx))
        }
      })
      .select("rect")
      .classed("plot",true)
      .attr("width",UNIT_SIZE.x*(gapf))
      .attr("height",UNIT_SIZE.y*(gapf))
      .attr("x",(d,i)=>scales.x(i % bcount)+UNIT_SIZE.x*(gapf/2))
      .attr("y",(d,i)=>scales.y(Math.floor(i / bcount))+UNIT_SIZE.y*(gapf/2))
      .attr("fill",d=>d==0?'white':d3.interpolateYlOrBr(scales.z(d)))
      .on("mouseover",function(){handleHover.call(this,true,...arguments)})
      .on("mouseout",function(){handleHover.call(this,false,...arguments)});

    //remove loading graphic
    body.style("background-image","none");
  };
})();
