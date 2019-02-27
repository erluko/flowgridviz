.PHONY: tidy clean

all: out/pcap.js

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@


data/pcap.json: ~/Downloads/ISCX_Botnet-Training.pcap
	tshark -r $< -T json -e ip.src -e ip.dst -e udp.srcport -e udp.dstport -e tcp.srcport -e tcp.dstport -c 10000  'tcp or udp' > $@

data/services.json: /etc/services
	awk -v Q="'" -F '[/ \t]*' '/^#/ {next} /\// {print "[" $$2 "," Q $$1 Q "]," }' $< | sort -unk1.2 > $@

tidy:
	$(RM) out/*

clean: tidy
	$(RM) data/*
