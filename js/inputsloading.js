(function(){
  // first watch for any existing load events
  let oldload = null;
  if(window.onload){
    oldload=window.onload;
  }
  window.onload = function(){
    if(typeof(oldload) == 'function'){
      oldload.apply(this,arguments);
    }
    let links = Array.from(document.getElementsByTagName("a"))
        .filter(x=>x.hasAttribute("href"));
    for(link of links){
      link.realhref=link.href;
      link.removeAttribute("href");
      link.ready='loading';
    }

    for(link of links) {
      let checkReady = (function(link){
        if(link.ready == 'loading'){
          let aj = new XMLHttpRequest();
          aj.addEventListener("load", function(){
            try{
              let status = JSON.parse(this.responseText);
              let ready = status['status'] || 'failed'
              link.ready = ready;
              if(ready != 'loading'){
                window.clearInterval(link.interval);
                let prev = link.previousElementSibling;
                if(ready == 'ready'){
                  link.setAttribute("href",link.realhref);
                  if(prev.tagName == 'IMG'){
                    prev.setAttribute("src","images/checkbox.png");
                  }
                } else {
                  if(prev.tagName == 'IMG'){
                    prev.setAttribute("src","images/redx.png");
                  }
                }
              }
            } catch (e){
              console.log(e);
            }
          });
          aj.open("GET", link.realhref+"ready.json");
          aj.send();
        }
      }).bind(null,link);
      checkReady();
      link.interval = window.setInterval(checkReady,1000)
    }

  }

})()
