.PHONY: tidy clean

ifdef npm_package_config_labeled_flows_file
flow_dest_file=data/input.gz
pcap_dest_file=data/pcap.txt.gz
input_mode=flow
endif

ifdef npm_package_config_pcap_file
flow_dest_file=data/sample-flows.gz
pcap_dest_file=data/ISCX-Bot-2014.gz
input_mode=pcap
endif

ifndef input_mode
$(error "Run this makefile via npm: 'npm run make' or 'npm install'")
endif

ifeq ($(npm_package_config_num_records), all)
undefine npm_package_config_num_records
endif

ifdef npm_package_config_num_records
NUM_RECORDS_PRE=-c
endif

all: input services

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@

input: $(flow_dest_file) $(pcap_dest_file)
services: out/services.js

#todo use NUM_RECORDS when reading flows
$(flow_dest_file):  $(npm_package_config_labeled_flows_file)
	./util/conv.js $< | gzip -c > $@

$(pcap_dest_file): $(npm_package_config_pcap_file)
	tshark -r $< -Tfields -E occurrence=f -Eseparator=/s -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport -e tcp.dstport $(NUM_RECORDS_PRE) $(npm_package_config_num_records) 'tcp or udp' |tr -s ' ' , | gzip -c > $@

data/services.json: $(npm_package_config_services_file)
	tr '\t' ' ' < $< | sed -n -e 's/^\([^#][^ $(TAB)]\{1,\}\)[ $(TAB)]\{1,\}\([0-9]\{1,\}\)\/.*$$/[\2,"\1"],/p' | sort -unk1.2 > $@

tidy:
	$(RM) out/*

clean: tidy
	$(RM) data/*
