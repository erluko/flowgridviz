(function(){
  let COOKIE_NAME="only_cookie";
  let MAX_COOKIE_LEN=400;
  let COOKIE_TRAILER=(window.location.protocol=='https:'?';Secure':'')+
      ';SameSite=Strict';

  let oc = {
    TooLarge:  function(){
      this.message = "Cookie value too large";
    },
    clear: function() {
      document.cookie.split('; ').map(function(s){let o=[];let c=-1;while((c=s.indexOf('=',c+1))!=-1) o.push(s.substr(0,c)); return o}).reduce((a,b)=>a.concat(b),[]).forEach(n=>document.cookie=n+'=;max-age=0');
    },
    set: function(v){
      oc.clear();
      let dc = COOKIE_NAME+"="+(btoa(JSON.stringify(v)).replace(/=/g,"_"));
      if(dc.length < MAX_COOKIE_LEN){
        return document.cookie = dc+COOKIE_TRAILER;
      } else {
        throw new oc.TooLarge();
      }
    },
    get: function(def){
      if(typeof def === 'undefined') def = null;
      let v = document.cookie;
      if(v.endsWith("; ")){
        v=v.substr(0,v.length-2);
      } else if (v.endsWith(";")){
        v=v.substr(0,v.length-1);
      }
      if(v.length<MAX_COOKIE_LEN && v.indexOf(';') == -1){
        let parts = v.split('=');
        if(parts.length == 2 && parts[0]==COOKIE_NAME){
          try{
            let a = parts[1].replace(/_/g,"=");
            let b = atob(a);
            return JSON.parse(b);
          } catch (e){
          }
        }
      }
      oc.clear();
      return def;
    }
  };
  window.OneCookie=oc;
})();
