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

Presumes the presence of `make`, `tr`, `sed`, `sort`, `/etc/services`,
`thsark`, and `node`. A future version will eliminate dependencies all
but the last two or three.

Presumes that there's a pcap file at
`~/Downloads/ISCX_Botnet-Training.pcap`. It's only used during initial
installation. This will be fixed in a future release.



Installing and Running
======================

    git clone https://github.gatech.edu/ekobrin3/2019-Spring-CSE6242-pcapviz.git
    cd pcapviz/prototypes
    npm install
    npm start


Then go to the url displayed at the console.

Caveats
=======

Currently the number of packets examined and the ip/port combo used
for the server are hard-coded. This will change.

License
=======

BSD 2-clause license. See LICENSE file for details.
