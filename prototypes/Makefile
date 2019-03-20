.PHONY: tidy clean

all: data/pcap.txt out/services.js

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@

data/pcap.txt: ~/Downloads/ISCX_Botnet-Training.pcap
	tshark -r $< -Tfields -Eseparator=/s -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport -e tcp.dstport -c 1000000  'tcp or udp' > $@

data/services.json: /etc/services
	tr '\t' ' ' < $< | sed -n -e 's/^\([^#][^ $(TAB)]\{1,\}\)[ $(TAB)]\{1,\}\([0-9]\{1,\}\)\/.*$$/[\2,"\1"],/p' | sort -unk1.2 > $@

tidy:
	$(RM) out/*

clean: tidy
	$(RM) data/*
