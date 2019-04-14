(function(){
    var inNode = !(typeof Window === 'function' &&
                 Window.prototype.isPrototypeOf(this));

  var root = inNode?module.exports:this;
  let importData = inNode?n=>require('../out/'+n+'.js').IMPORT_DATA.get(n):n=>IMPORT_DATA.get(n);

  let settings = OneCookie.get({anim:true,shrt:false});
  let settingsWatchers = Object.entries(settings).reduce((a,[k,v])=>(a[k]=[],a),{});

  let ready = importData('ready');
  if(!ready){
    window.onload=function(){
      let body = d3.select("body");
      body.selectAll('*').remove();
      let s="Loading data. Please wait.";
      document.title=s;
      let h1=body.append("H1").text(s);
      window.setTimeout(_=>window.location=window.location,1000);
      return;
    }
    return;
  }
  pdata = importData('pmatrix');
  let sources = new Set(pdata.sources);
  let dests = new Set(pdata.dests);
  let plotrix = pdata.matrix;
  let labels = importData('labels');
  let inp = importData('input');
  let input_key = inp[0];
  let input_rec = inp[1];
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

    let pathParts = pathutil.pathParser(window.location.pathname
                                        .substring(0,window.location.pathname.length-"index.html".length));
    let top_level = pathutil.isTopLevel(pathParts);

    let chunks = ["inputs",input_key,].concat(pathParts.reduce((o,p)=>o.concat(p),[]))
    let numparts = chunks.length - (chunks[chunks.length-1]==null?2:1);
    let dots = Array.from({length:numparts},x=>'../');

    let body = d3.select("body");

    let showLoading = function(){
      svg.style("opacity",0);
      body.style("background-image",null);
    }

    let hideLoading = function(){
      svg.style("opacity",1);
      body.style("background-image","none");
    }

    if(input_rec.title){
      let titleDetail =document.createTextNode(input_rec.title);
      let colon = document.createTextNode(": ");
      if(input_rec.ref){
        let text = titleDetail;
        titleDetail = document.createElement("a");
        titleDetail.setAttribute("href",input_rec.ref);
        titleDetail.setAttribute("target","_blank");
        titleDetail.appendChild(text);
      }
      let h1=body.select("h1").node();
      h1.appendChild(colon);
      h1.appendChild(titleDetail);
      document.title=h1.innerText;
    }

    body.select("div.nav")
      .selectAll("span.uplink")
      .data(chunks)
      .enter()
      .append("span")
      .classed("uplink",true)
      .text(" / ")
      .append("a")
      .attr("href",function(d,i,a) {
        if(i==1){
          return null;
        } else if(i==0){
          return dots.slice(i+i%2).join('');
        } else if(numparts-i>1){
          return dots.slice(i+i%2).join('')+'index.html';
        }
        return null;
      })
      .each(function(){if(this.href) d3.select(this).on("click",showLoading)})
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
      .on("click",showLoading)
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

   svg.append("defs")
      .append("clipPath")
      .attr("clipPathUnits","objectBoundingBox")
      .attr("id","cpth")
      .append("rect")
      .attr("width","1")
      .attr("height","1")

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

    let gapf = 1;

    /* Subgraphs are described in lib/matrixexplorer.js

       The implementation here takes the current path and links
       "index.html" in a virtual subdirectory whose relative
       "pmatrix.js" will contain the specfic matrix information for
       the selected index.
     */
    let subgraphURL = function(idx){
      let newpath='./'+idx+'/'+pdata.stype+pdata.dtype+'/index.html'
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

    body.style("width",getSize(tipHolder,"right", svgHolderWidth)+"px");
    body.style("background-position", (svgHolderWidth/2)+"px center");

    let tip = {count: tipHolder.append("span"),
               label: labels.length>0?(tipHolder.append("br"),tipHolder.append("span")):{text:_=>null},
               source: (tipHolder.append("br"),tipHolder.append("span")),
               dest: (tipHolder.append("br"),tipHolder.append("span")),
              }

    function elideText(text,max){
      return text.length > max?text.substr(0,max-1)+'\u2026':text;
    }

    function showTotals(){
      let shorten = settings.shrt;
      tip.count.text("Total Count: "+totalPackets)
      let fromtext = pdata.sources.map(type_display[pdata.stype]).join(' ');
      if(shorten) fromtext = elideText(fromtext,1000);
      tip.source.text("from: "+ fromtext);
      let totext = pdata.dests.map(type_display[pdata.dtype]).join(' ');
      if(shorten) totext = elideText(totext,1000);
      tip.dest.text("to: " + totext);
      tip.label.text("label(s): "+(usedL==0?'None':labels.filter((n,i)=>usedL & 1<<i)));
    }

    settingsWatchers.shrt.push(showTotals);

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
      .on("click",function(){
        if(settings.anim){
          let anchor = d3.select(this);
          d3.event.preventDefault()
          let crect = d3.select(svg.node()
                                .appendChild(anchor.select("rect")
                                             .node()
                                             .cloneNode()));
          let recs = d3.selectAll('rect.plot')
              .transition()
              .style("opacity",0);

          crect.style('clip-path','none')
            .style("opacity",0.1)
            .transition()
            .attr("width",WIDTH-PADDINGS.x)
            .attr("height",HEIGHT-PADDINGS.y)
            .attr('x',scales.x(0))
            .attr('y',scales.y(0))
            .style("opacity",1)
            .on("end",_=>{window.location=anchor.attr("href");
                          showLoading()});
        } else {
          showLoading();
        }
      })
      .select("rect")
      .attr("width",UNIT_SIZE.x*(gapf))
      .attr("height",UNIT_SIZE.y*(gapf))
      .attr("x",([idx,[v,l]])=>scales.x((+idx) % bcount)+UNIT_SIZE.x*(gapf/2))
      .attr("y",([idx,[v,l]])=>scales.y(Math.floor((+idx) / bcount))+UNIT_SIZE.y*(gapf/2))
      .attr("fill",([idx,[v,l]])=>v=0?'white':d3.interpolateYlOrBr(scales.z(v)))
      .classed("labeled",([idx,[v,l]])=>l!=0)
      .on("mouseover",function(){handleHover.call(this,true,...arguments)})
      .on("mouseout",function(){handleHover.call(this,false,...arguments)})

    let setbox = body.select('#settings-panel');
    let gear = body.select('#gear');

    let options = setbox.append("form")
        .selectAll("label.setting")
        .data([{name:"Use Animations",cname:"anim"},
               {name:"Abbreviate Long Lists",cname:"shrt"},])
        .enter()
        .append("label")
        .classed("setting",true)

    options.append("input")
      .attr("type","checkbox")
      .attr("checked",d=>settings[d.cname]?"checked":null)
      .on("change",function(){
        let me = d3.select(this);
        let d = me.datum();
        settings[d.cname]=this.checked;
        settingsWatchers[d.cname].forEach(x=>x(this.checked));
        OneCookie.set(settings);
      })

    options.append(d=>document.createTextNode(d.name));

    setbox.style("left",((getSize(gear,"right") - getSize(setbox,"width"))+"px"))
      .style("top",getSize(gear,"bottom")+"px");

    let win = d3.select(window);
    let windowHideSettings = function(){
      if(d3.event.target!=gear.node() &&
         !setbox.node().contains(d3.event.target)){
        gear.dispatch("click")
      }
    }
    gear.on("click",
            function(){
              if(setbox.style("visibility") == "visible"){
                win.on("click.settings",null);
                setbox.style("visibility","hidden")
              } else {
                setbox.style("visibility","visible")
                win.on("click.settings", windowHideSettings);
              }
            })
    //remove loading graphic
    hideLoading();
  };
})();
