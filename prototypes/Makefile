.PHONY: clean

10k.json: ~/Downloads/ISCX_Botnet-Training.pcap
	tshark -r $< -T json -e ip.src -e ip.dst -e udp.srcport -e udp.srcport -e tcp.srcport -e tcp.dstport -c 100  'tcp or udp' > $@

10k.js: jstemplate.js 10k.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(basename $@)/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@
