These are the steps I took to install flowgridviz on a local VM running
Amazon Linux 2. They are not guaranteed to be reproducible.


# First, fetch the pcaps in the background. This will take a while.

    # this is one example, you can use another
    curl -sO https://iscxdownloads.cs.unb.ca/iscxdownloads/ISCX-Bot-2014/ISCX_Botnet-Training.pcap &

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


# install wireshark to get tshark

    #only if using actual pcaps and not just flows
    sudo yum install -y wireshark


# set up repo

    git init --bare flowgridviz.git

# STOP HERE

    exit; #this line is here for people who copy-and-paste without reading

# On your own machine run:

    #git remote add aws ssh://[user@host]/~/flowgridviz.git
    #git push aws master


# Back on AWS, clone the repo:

    git clone flowgridviz.git

# Configure `G_SLICE` to not break tshark:

    #thanks to:  https://unix.stackexchange.com/questions/281523/tshark-memory-error-6265-gslice-assertion-failed-sinfo-n-allocate https://developer.gnome.org/glib/stable/glib-running.html
    export G_SLICE=always_malloc

# Prepare the repository for serving

    cd flowgridviz
    npm config set flowgridviz:num_packets "all"
    npm config set flowgridviz:url_root fgv

# Configure nginx

    npm run conf_nginx
    sudo cp nginx/flowgridviz.conf /etc/nginx/default.d/
    sudo systemctl start nginx


# Final repository setup (depends on giant pcap download)

    wait %1 #wait for pcap download to complete
    ./util/convert-pcap.sh $(pwd)/../ISCX_Botnet-Training.pcap | \
      gzip -c > data/ISCX-Bot-2014.gz
    echo '[["ISCX-Bot-2014",{"file": "ISCX-Bot-2014.gz",
          "title": "Unabeled 9M packet ISCX_Botnet-Training.pcap"}]]' \
       > data/inputs.json
    npm install
    pm2 start #if you skipped pm2 installation, run npm start


# Now for TLS

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
