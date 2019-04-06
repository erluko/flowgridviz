Interactive Packet Capture Visualization
========================================

This is web-based packet capture or net flow explorer.  It maps the
sources and destinations of tcp and udp traffic onto a 53x53 grid.
Sources and destinations are either port numbers or IP addresses. Each
grid point represents the intersection of source and destination. The
darkness of each point is based on the number of such pairs present in
the input data.

The hashing function used to make the initial reduction down to the
coordinate space is intentionally reversible so that the list of
actually observed ports or IPs for a point can be calculated after the
fact without having to store a complete bidirectional mapping.

When examining the totality of the traffic, the system applies its
awareness of special ports that are part of the same protocol (e.g. 20
and 21 for ftp, 80 and 8080 for http)* and hashes them to the same
value. When investigating a subset of traffic, the list of applicable
ports is intended to spread for best visual separation.

For any given graph point, mousing over will reveal details of the
traffic that *might* have led to that point being illuminated and
clicking will cause the graph to redraw, including only elements that
*actually* caused that point to illuminate.

[*]: Not as currently implemented. This will be configurable.

Input Data
==========

Input data is read from a file on disk at startup time. pcapviz can
read gzipped input data and this is highly recommended. The input data
file location is configurable. See CONFIGURATION below for
details.

The input data format is:

    source_ip,dest_ip,source_port,dest_port[,weight,label,identifier]

If not specified, the weight defaults to 1 and both the label and the
identifier default to the empty string. The weight is used as a
multiplier when constructing the visualization matrix. The labels are
used to highlight particular cells in the matrix, and the identifier
is an arbitrary string of your choice, useful for referencing
particular packets or flows in the source data.

For packet captures, the appropriate format can be generated using
`tshark` and `tr`:

     tshark -r YOUR_FILE.pcap -Tfields -E occurrence=f -Eseparator=/s \
     -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport \
     -e tcp.dstport 'tcp or udp' |tr -s ' ' , |gzip -c > data_file.gz

For network flows, the output of `pcaplabel` or `cicflowmeter` can be
used.  The output of either of these tools can be converted to the
appropriate format using `util/conf.js`. That utility defaults to
setting the weight to the value of `Tot Fwd Pkts`.


Prerequisites
=============

Installation requires an Internet connection for the node.js
prerequisite download. No Internet connection is needed once `npm
install` is complete.

Presumes the presence of `make`, `tr`, `sed`, `sort`, `gzip`,
`/etc/services`, and `node`. If reading from a pcap, `tshark` is
required as well. A project goal is to reduce these dependencies over
time.


Installing and Running
======================

    git clone https://github.gatech.edu/ekobrin3/2019-Spring-CSE6242-pcapviz.git
    cp input/sample-flows.gz input/flows.gz
    npm install
    npm start

Then go to the url displayed at the console.

If you want a more robust setup, use `nginx` as a reverse proxy and
`pm2` for process management, as described below.


Configuration
=============

Install-time
------------

The following options affect the program's behavior at
install-time. If you want to change them after running `npm install`,
run: `npm run make -- -B input` to regenerate the input file or run
`npm run make -- -B services` to regenerate the services file.

To choose an alternate mapping of known ports to service names, set
`pcapviz:services_file`. It defaults to '/etc/services' but you can
use another mapping:

    npm config set pcapviz:services_file /path/to/file

The source of the network data is configurable. It can either be a
file with labeled network flows or a pcap file.

To use a list of labeled flows, set `pcapviz:labeled_flows_file`. To
use a pcap file for input, set `pcapviz:pcap_file`.

If neither is explicitly set, the default is to use labeled flow data
from `input/flows.gz`.

You can set these values as follows:

    npm config set pcapviz:pcap_file /path/to/file

or

    npm config set pcapviz:labeled_flows_file /path/to/file

To select the number of records processed, set `pcapviz:num_records` to a
number. To process all records in the pcap, set it to the empty string
or "all".

    npm config set pcapviz:num_records "10000"  #process first 10k records
    npm config set pcapviz:num_records "all"    #process all records

Runtime
-------

The IP and port to bind, and the URL root are configurable.
For example:

    npm config set pcapviz:port 8080
    npm config set pcapviz:listen_ip 127.0.0.1
    npm config set pcapviz:url_root pcv

Will make the application available at: http://127.0.0.1:8080/pcv/

Setting `url_root` to the empty string or to `/` will serve it from '/'.

Running Under NGINX
-------------------

Execute `npm run conf_nginx` to put a reasonable nginx confg file in
`nginx/pcapviz.conf`. This file is suitable for inclusion in a
`server{}` block in your nginx configuration.

For example, if your nginx config contains the following (which is
default from Amazon Linux 2):
    server {
        listen       80 default_server;
        listen       [::]:80 default_server;
        server_name  _;
        root         /usr/share/nginx/html;

        # Load configuration files for the default server block.
        include /etc/nginx/default.d/*.conf;
        ...
    }

Then you can configure nginx by running the following, assuming you've
already enabled nginx (`sudo systemctl enable nginx`):

    npm config set pcapviz:url_root pcv
    npm run conf_nginx
    sudo cp nginx/pcapviz.conf /etc/nginx/default.d/
    sudo systemctl restart nginx
    npm start #consider using pm2 instead (see below)

Now pcapviz is running at http://*your_hostname*/pcv/


PM2
---

If [PM2](https://pm2.io) is installed, you can get process management
for pcapviz. Use `pm2 start` instead of `npm start`. Use `pm2 status`
to see process status and `pm2 stop pcapviz` to stop the server. This
all works particularly well with nginx.


Acknowledgments
===============

PCAP sample data is from
https://iscxdownloads.cs.unb.ca/iscxdownloads/ISCX-Bot-2014/ISCX_Botnet-Training.pcap

Loading graphic (images/loading.gif) was generated using
http://www.ajaxload.info/

Public domain transparent favicon is from
http://transparent-favicon.info/favicon.ico

Express template system for DOM manipulation (lib/jsdt.js) is inspired
by https://github.com/AndersDJohnson/express-views-dom but shares no
code with it.

nginx configuration guidance from
https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-16-04
was helpful. It took some tweaking to make it work on Amazon Linux 2.

Pre-deployment testing was made possible by Amazon's guide to running
an EC2-like Linux image in VirtualBox:
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-linux-2-virtual-machine.html

See package.json for a list of server-side dependencies.

License
=======

BSD 2-clause license. See LICENSE file for details.
