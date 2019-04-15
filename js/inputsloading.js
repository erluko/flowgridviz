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
    // get all anchor tags with href attributes
    // known-bad sources will lack an href
    let links = Array.from(document.getElementsByTagName("a"))
        .filter(x=>x.hasAttribute("href"));
    for(link of links){
      // back up href
      link.realhref=link.href;

      // remove href to unlink anchor until load is done
      link.removeAttribute("href");

      // set state for this data source to 'loading'
      link.ready='loading';
    }

    for(link of links) {
      let checkReady = (function(link){
        if(link.ready == 'loading'){
          // ask server if the source is done loading
          let aj = new XMLHttpRequest();
          aj.addEventListener("load", function(){
            try{
              let status = JSON.parse(this.responseText);
              let ready = status['status'] || 'failed'
              link.ready = ready;
              if(ready != 'loading'){
                // no longer loading (success or failure), stop polling
                window.clearInterval(link.interval);
                let prev = link.previousElementSibling;
                if(ready == 'ready'){
                  // data source loaded successfully
                  // restore the anchor link
                  link.setAttribute("href",link.realhref);
                  // show a checkbox
                  if(prev.tagName == 'IMG'){
                    prev.setAttribute("src","images/checkbox.png");
                  }
                } else {
                  // data source failed to load
                  // leave the anchor disabled, show a red "X"
                  if(prev.tagName == 'IMG'){
                    prev.setAttribute("src","images/redx.png");
                  }
                }
              }
            } catch (e){
              console.log(e);
            }
          });
          // status polling url:
          aj.open("GET", link.realhref+"ready.json");
          aj.send();
        }
      }).bind(null,link);
      checkReady();
      // check once per second per source
      link.interval = window.setInterval(checkReady,1000)
    }
  }
})()
