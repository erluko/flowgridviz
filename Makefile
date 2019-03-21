.PHONY: tidy clean

ifndef npm_package_config_pcap_file
$(error "Run this makefile via npm: 'npm run make' or 'npm install'")
endif

ifeq ($(npm_package_config_num_packets), all)
undefine npm_package_config_num_packets
endif

ifdef npm_package_config_num_packets
NUM_PACKETS_PRE=-c
endif

all: data/pcap.txt.gz out/services.js

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@

data/pcap.txt.gz: $(npm_package_config_pcap_file)
	tshark -r $< -Tfields -Eseparator=/s -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport -e tcp.dstport $(NUM_PACKETS_PRE) $(npm_package_config_num_packets) 'tcp or udp' |gzip -c > $@

data/services.json: $(npm_package_config_services_file)
	tr '\t' ' ' < $< | sed -n -e 's/^\([^#][^ $(TAB)]\{1,\}\)[ $(TAB)]\{1,\}\([0-9]\{1,\}\)\/.*$$/[\2,"\1"],/p' | sort -unk1.2 > $@

tidy:
	$(RM) out/*

clean: tidy
	$(RM) data/*
