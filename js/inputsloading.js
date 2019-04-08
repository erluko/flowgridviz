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
    let links = document.getElementsByTagName("a");
    for(link of links){
      link.realhref=link.href;
      link.removeAttribute("href");
      link.ready=false;
    }

    for(link of links) {
      let checkReady = (function(link){
        if(!link.ready){
          let aj = new XMLHttpRequest();
          aj.addEventListener("load", function(){
            try{
              let ready = JSON.parse(this.responseText);
              link.ready = ready;
              if(ready){
                link.setAttribute("href",link.realhref);
                let prev = link.previousElementSibling;
                if(prev.tagName == 'IMG'){
                  prev.setAttribute("src","images/checkbox.png");

                }
                window.clearInterval(link.interval);
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
