# Guide to installing flowgridviz on AWS -- make sure you have 8gb of RAM on your instance

# Optional: install the mg editor

    curl -LO https://github.com/hboetes/mg/releases/download/20180927/mg-20180927-static-x86_64
    chmod 755 mg-20180927-static-x86_64
    sudo mv mg-20180927-static-x86_64 /usr/bin/mg


# install nginx

    sudo amazon-linux-extras install -y nginx1.12
    sudo systemctl enable nginx


# install node

    curl -sOL https://rpm.nodesource.com/setup_11.x
    sudo bash ./setup_11.x
    sudo yum install -y nodejs


# install pm2

    sudo npm install -g pm2


# install git

    sudo yum install -y git


# clone flowgridviz from github

    git clone https://github.com/erluko/flowgridviz


# Prepare the repository for serving

    cd flowgridviz
    npm config set flowgridviz:num_records "all"
    npm config set flowgridviz:url_root fgv
    npm install
    pm2 start #if you skipped pm2 installation, run npm start
    # flowgrigviz is now live locally, listening at http://127.0.0.1:8080/fgv/


# Configure nginx

    npm run conf_nginx
    sudo cp nginx/flowgridviz.conf /etc/nginx/default.d/
    sudo systemctl start nginx


# Now for TLS. Your sever needs a public-facing domain name for this to work.

    curl -sLO  https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
    sudo yum install -y ./epel-release-latest-7.noarch.rpm
    sudo yum install -y certbot python2-certbot-nginx


# The next bit is interactive:

    sudo certbot --nginx


# Optional: redirect from / to the flowgridviz dir

    # in /etc/nginx.conf, look for the "location / {}" block that has
    # your cert name as server_name, add:
    #    return 301 https://$host/fgv/ ;
    # Note: if you have flowgridviz installed somewhere other than /fgv/
    # make sure you use the same value as you used for flowgridviz:url_root


# Optional: Replace old default site with redirect to TLS site

    #remove:    include /etc/nginx/default.d/*.conf;
    #remove:    location / {
    #add:       return 301 https://[YOUR_CERT_DOMAIN]$request_uri;
    #remove:    }
