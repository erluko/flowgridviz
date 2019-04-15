/* System for storing state in a single cookie  (b64-encoded JSON) */
(function(){
  let COOKIE_NAME="only_cookie"; // arbitrary cookie name
  let MAX_COOKIE_LEN=400;        // arbitrary max size

  // Secure defaults:
  let COOKIE_TRAILER=(window.location.protocol=='https:'?';Secure':'')+
      ';SameSite=Strict';

  let oc = {
    TooLarge:  function(){ // Exception constructor
      this.message = "Cookie value too large";
    },
    clear: function() { // clear ALL cookies aggressively
      document.cookie.split('; ').map(function(s){let o=[];let c=-1;while((c=s.indexOf('=',c+1))!=-1) o.push(s.substr(0,c)); return o}).reduce((a,b)=>a.concat(b),[]).forEach(n=>document.cookie=n+'=;max-age=0');
    },
    set: function(v){ // set the value of the one single cookie
      oc.clear();
      // make base64 cookie-safe:
      let dc = COOKIE_NAME+"="+(btoa(JSON.stringify(v)).replace(/=/g,"_"));
      if(dc.length < MAX_COOKIE_LEN){
        return document.cookie = dc+COOKIE_TRAILER;
      } else {
        throw new oc.TooLarge();
      }
    },
    // get the cookie value as an object, return "def" if not found
    get: function(def){
      if(typeof def === 'undefined') def = null;
      let v = document.cookie;
      /* The next four lines are for browser weirdness compatibility
         They sometimes leave trailing semicolons for cookies with
         blank names or deleted cookies. It's a browser bug. */
      if(v.endsWith("; ")){
        v=v.substr(0,v.length-2);
      } else if (v.endsWith(";")){
        v=v.substr(0,v.length-1);
      }
      /* only attempt decoding if the cookie length is short enough
         and not obviously a mess. This prevents an algorithmic-complexity
         DOS on the JSON parser and avoids some multi-cookie weirdness */
      if(v.length<MAX_COOKIE_LEN && v.indexOf(';') == -1){
        let parts = v.split('=');
        if(parts.length == 2 && parts[0]==COOKIE_NAME){
          try{
            // restore "=" removed above
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
