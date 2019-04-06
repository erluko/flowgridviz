(function(){
    var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);


  pdata = importData('pmatrix');
  let sources = new Set(pdata.sources);
  let dests = new Set(pdata.dests);
  let plotrix = pdata.matrix;
  let labels = importData('labels');
  let type_labels = {p: 'Port',i: "IP"};
  let type_display = {p: x=>x,
                      i: x=> ((x >>> 24 & 0x0FF)+'.'+
                              (x >>> 16 & 0x0FF)+'.'+
                              (x >>>  8 & 0x0FF)+'.'+
                              (x >>>  0 & 0x0FF))};


  let phr = inNode?require('nethasher.js'):{nethasher: root.nethasher};
  let bcount = phr.nethasher.getBucketCount();
  let ph = new phr.nethasher(pdata.hashconfig);

  // first watch for any existing load events
  let oldload = null;
  if(window.onload){
    oldload=window.onload;
  }


  function getSize(sel,name,def){
    try{
      s = +sel.node().getBoundingClientRect()[name];
    } catch(e){}
    if(isNaN(s)){
      s = +sel.attr("name").replace(/px/,'');
    }
    if(isNaN(s)){
      s = +sel.style("name").replace(/px/,'');
    }
    if(isNaN(s)){
      s = def;
    }
    return s;
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
    let pathParts = pathutil.pathParser(window.location.pathname);
    let top_level = pathutil.isTopLevel(pathParts);

    let chunks = pathParts.flatMap(x=>x);
    let numparts = chunks.length - (chunks[chunks.length-1]==null?2:1);
    let dots = Array.from({length:numparts},x=>'../');

    let body = d3.select("body");
     body.select("div.nav")
      .selectAll("span.uplink")
      .data(chunks)
      .enter()
      .append("span")
      .classed("uplink",true)
      .text(" / ")
      .append("a")
      .attr("href",(d,i,a)=>numparts-i>1?dots.slice(i).join('')+'index.html':null)
      .text(v=>v instanceof Array?v.join(''):v)

    let sel = pdata.stype+pdata.dtype;
    body.select("div.types")
      .selectAll("a.type")
      .data("pp pi ip ii".split(" "))
      .enter()
      .append("a")
      .attr("href",d=>'../'+d+'/index.html')
      .attr("class",d=>d+"_link")
      .classed("types_selected",d=>d==sel)
      .text(d=>d)

    let svgHolder = body.select("div.graph");

    let svgHolderWidth = getSize(svgHolder,"width", 700)

    let WIDTH = svgHolderWidth - 8
    let HEIGHT = WIDTH;

    var SIZES = {x:WIDTH, y:HEIGHT};

    let svg = svgHolder.append("svg")
        .attr("width",WIDTH)
        .attr("height",HEIGHT)
//todo: FIXME
    svg.node().setAttribute("xmlns:xlink","http://www.w3.org/1999/xlink");

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
      .text("Source "+type_labels[pdata.stype])

    svg.append("g")
      .classed("x-axis-label",true)
      .append("text")
      .attr("x",WIDTH/2)
      .attr("y",HEIGHT-PADDINGS.bottom+8)
      .text("Destination "+type_labels[pdata.dtype])

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


    let totalPackets = 0;
    let maxCount = 0;
    let usedL = 0;
    plotrix.forEach(function ([i,[v,l]]) {
      usedL = usedL | l;
      maxCount = Math.max(maxCount,v);
      totalPackets += v;
    });

    scales.z = d3.scaleLog()
      .domain([1,maxCount])
      .range([0.15,1]);

    let gapf = 1;//0.03;
    let rf = 1;//0.08;

    /* Subgraphs are described in lib/matrixexplorer.js

       The implementation here takes the current path and links
       "index.html" in a virtual subdirectory whose relative
       "pmatrix.js" will contain the specfic matrix information for
       the selected index.
     */
    let subgraphURL = function(idx){
      let newpath='./'+idx+'/'+pdata.stype+pdata.dtype+'/index.html'
      if(window.location.pathname.startsWith('/index.html')){
        newpath = 'pp/'+newpath;
      }
      return newpath;
    }

    let valuesForIndex = function(idx){
      let x = idx % bcount;
      let y = Math.floor(idx / bcount);
      let sps = ph.backhash(y,sources);
      let dps = ph.backhash(x,dests);
      return [sps,dps];
    }

    let tsharkfilter = body.select(".tsharkfilter");
    let tsa = tsharkfilter.append("a")
        .attr("href","#tfilter")
        .text("Show filter");

    let tfilter = tsharkfilter.append("div")
        .classed("tfilter", true)
        .attr("id","tfilter")
        .classed("hidden", true);

    function toggleFilter(){
      let showNow = tfilter.classed("hidden");
      if(tfilter.text() == ''){
        tfilter.text(top_level?'tcp or udp':filtermaker.tsDisplayFilter(
          pdata.sources.map(type_display[pdata.stype]),
          pdata.dests.map(type_display[pdata.dtype]),
          pdata.stype,pdata.dtype));
      }
      tsa.text(showNow?"Hide filter":"Show filter");
      tfilter.classed("hidden",!showNow);
    }
    tsa.on("click",toggleFilter)

    let tipHolder = body.select("div.port-tip")
        .style("height",scales.y(bcount)+"px")
        .style("position","absolute")
        .style("top",getSize(svgHolder,"top", 50)+"px")
        .style("left",getSize(svgHolder,"right", svgHolderWidth)+"px")

    let tip = {count: tipHolder.append("span"),
               source: (tipHolder.append("br"),tipHolder.append("span")),
               dest: (tipHolder.append("br"),tipHolder.append("span")),
               label: (tipHolder.append("br"),tipHolder.append("span")),
              }

    function showTotals(){
      tip.count.text("Total Count: "+totalPackets)
      tip.source.text("from: "+pdata.sources.map(type_display[pdata.stype]).join(' '));
      tip.dest.text("to: "+pdata.dests.map(type_display[pdata.dtype]).join(' '));
      tip.label.text("label(s): "+(usedL==0?'None':labels.filter((n,i)=>usedL & 1<<i)));
    }
    function handleHover(mode,[idx,[c,l]],index,nodes){
      if(mode){
        let [sps,dps] = valuesForIndex(+idx);
        tip.count.text("count: "+c)
        tip.source.text("from: "+sps.map(type_display[pdata.stype]).join(' '));
        tip.dest.text("to: "+dps.map(type_display[pdata.dtype]).join(' '));
        tip.label.text("label(s): "+(l==0?'None':labels.filter((n,i)=>l & 1<<i)));
      } else {
        showTotals()
      }
    }
    showTotals();

    let as = svg.selectAll("a.plot")
        .data(plotrix);

    // next line not needed unless changing node counts
    as.exit().remove();

    let newAs=as.enter()
        .append("a")
        .classed("plot",true)

    newAs.append("rect")
        .classed("plot",true);

    as.merge(newAs)
      .attr("xlink:href",([idx,v]) => subgraphURL(+idx))
      .select("rect")
      .attr("width",UNIT_SIZE.x*(gapf))
      .attr("height",UNIT_SIZE.y*(gapf))
      .attr("x",([idx,[v,l]])=>scales.x((+idx) % bcount)+UNIT_SIZE.x*(gapf/2))
      .attr("y",([idx,[v,l]])=>scales.y(Math.floor((+idx) / bcount))+UNIT_SIZE.y*(gapf/2))
      .attr("fill",([idx,[v,l]])=>v=0?'white':d3.interpolateYlOrBr(scales.z(v)))
      .classed("labeled",([idx,[v,l]])=>l!=0)
      .on("mouseover",function(){handleHover.call(this,true,...arguments)})
      .on("mouseout",function(){handleHover.call(this,false,...arguments)});

    //remove loading graphic
    body.style("background-image","none");
  };
})();
