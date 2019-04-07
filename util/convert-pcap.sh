#!/bin/sh
fname="$1";
shift;

tshark -r "$fname" -Tfields -E occurrence=f -Eseparator=/s -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport -e tcp.dstport "$@" 'tcp or udp' |tr -s ' ' ,
