Interactive Packet Capture Visualization
========================================

This is an early version of a packet capture explorer.  It maps the
source ports and destination ports of tcp and udp traffic in a .pcap
file into a 256x256 grid. Each grid point represents the intersection
of src and dest port. The darkness of each point is based on the
number of such pairs present in the packet capture. Future versions
will make it possible to have either axis represent ports or IP
addresses.

The hashing function used to make the initial reduction down to an
8-bit space is intentionally reversible so that the list of actually
observed ports for a point can be calculated after the fact without
having to store a complete bidirectional mapping in RAM on the client.

When examining the totality of the traffic, the system applies its
awareness of special ports that are part of the same protocol (e.g. 20
and 21 for ftp, 80 and 8080 for http) and hashes them to the same
value. When investigating a subset of traffic, the list of applicable
ports is intended to spread for best visual separation.

For any given graph point, mousing over will reveal details of the
traffic that led to that point being illuminated and clicking will
cause the graph to redraw, including only elements that caused that
point to illuminate.


Prerequisites
=============

Installation requires an internet connection for the node.js
prerequisite download. No connection is needed once `npm install` is
complete.

Presumes the presence of `make`, `tr`, `sed`, `sort`, `gzip`,
`/etc/services`, `thsark`, and `node`. A future version will eliminate
dependencies all but the last two or three.


Installing and Running
======================

    git clone https://github.gatech.edu/ekobrin3/2019-Spring-CSE6242-pcapviz.git
    npm install
    npm start


Then go to the url displayed at the console.

Configuration
=============

Install-time
------------

The following options affect the program's behavior at
install-time. If you want to change them after running `npm install`,
you can remove the contents of the `data/` directory and then execute `npm
run make`.

The source of the packet capture data is configurable. It defaults to
`~/Downloads/ISCX_Botnet-Training.pcap`. Override it as follows:

    npm config set pcapviz:pcap_file /path/to/file

To select the number of packets processed, set `pcapviz:pcap_file` to a
number. To process all packets in the pcap, set it to the empty string
or "all".

    npm config set pcapviz:num_packets "10000"  #process first 10k packets
    npm config set pcapviz:num_packets "all"    #process all packets

To choose an alternate mapping of known ports to service names, set
`pcapviz:services_file`. It defaults to '/etc/services' but you can
use another mapping:

    npm config set pcapviz:services_file /path/to/file

Runtime
-------

The IP and port to bind are now configurable:

    npm config set pcapviz:port 8080
    npm config set pcapviz:listen_ip 127.0.0.1


License
=======

BSD 2-clause license. See LICENSE file for details.
