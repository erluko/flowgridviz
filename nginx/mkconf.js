let url_root = process.env.npm_package_config_url_root || '/';
if(!url_root.endsWith("/")) url_root=url_root+'/';
if(!url_root.startsWith("/")) url_root='/'+url_root;

let fqdn =  process.env.npm_package_config_nginx_hostname;
if(! fqdn ){
  try {
    let fs = require('fs');
    fqdn = fs.readFileSync('/etc/mailname').toString().trim();
  } catch(e){}
}
if(! fqdn ){
  let os = require('os');
  fqdn = os.hostname() || 'localhost';
}

let fullconf =  process.env.npm_package_config_nginx_full_config;
if(fullconf && /no|false|null|disabled/i.test(fullconf)){
   fullconf = false;
}

if(fullconf){
  process.stdout.write(`server {
  listen 80;
  listen [::]:80;

  server_name ${fqdn};

  root /dev/null;
  index /dev/null;

  location / {
    return 301 $scheme://$host${url_root};
  }
`);
}
process.stdout.write(`   location ${url_root} {
        proxy_pass http://${process.env.npm_package_config_listen_ip}:${process.env.npm_package_config_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
`);

if(fullconf){
  process.stdout.write('}\n');
}
