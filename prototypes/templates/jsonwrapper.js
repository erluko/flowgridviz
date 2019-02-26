(function(){
  if(typeof IMPORT_DATA === 'undefined'){
    IMPORT_DATA = new Map();
  }
  // NOTE: this section is filled in by sed.
  let data = [
    //INSERT_DATA_HERE
  ]; //end data
  if(data.length == 1) {
    data = data[0];
  }
  IMPORT_DATA.set('INSERT_KEY_NAME_HERE',data);
})();

