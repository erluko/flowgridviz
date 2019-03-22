These are the steps I took to install pcapviz on a local VM running
Amazon Linux 2. They are not guaranteed to be reproducible.


# First, fetch the pcaps in the background. This will take a while.

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

    sudo yum install -y wireshark


# set up repo

    git init --bare pcapviz.git

# STOP HERE

    exit; #this line is here for people who copy-and-paste without reading

# On your own machine run:

    #git remote add aws ssh://[user@host]/~/pcapviz.git
    #git push aws master


# Back on AWS, clone the repo:

    git clone pcapviz.git

# Configure `G_SLICE` to not break tshark:

    #thanks to:  https://unix.stackexchange.com/questions/281523/tshark-memory-error-6265-gslice-assertion-failed-sinfo-n-allocate https://developer.gnome.org/glib/stable/glib-running.html
    export G_SLICE=always_malloc

# Prepare the repository for serving

    cd pcapviz
    npm config set pcapviz:num_packets "all"
    npm config set pcapviz:url_root pcv
    npm config set pcapviz:pcap_file $(pwd)/../ISCX_Botnet-Training.pcap


# Configure nginx

    npm run conf_nginx
    sudo cp nginx/pcapviz.conf /etc/nginx/default.d/
    sudo systemctl start nginx


# Final repository setup (depends on giant pcap download)

    wait %1 #wait for pcap download to complete
    npm install
    pm2 start #if you skipped pm2 installation, run npm start


# Now for TLS

    curl -sLO  https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
    sudo yum install -y ./epel-release-latest-7.noarch.rpm
    sudo yum install -y certbot python2-certbot-nginx

# The next bit is interactive:

    sudo certbot --nginx

# Consider redirecting from / to the pcapviz dir

    #in /etc/nginx.conf, look for the "location / {}" block, add:
    return 301 https://$host/pcv/ ;
