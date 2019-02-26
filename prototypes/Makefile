.PHONY: clean

all: out/10k.js

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@


data/10k.json: ~/Downloads/ISCX_Botnet-Training.pcap
	tshark -r $< -T json -e ip.src -e ip.dst -e udp.srcport -e udp.srcport -e tcp.srcport -e tcp.dstport -c 100  'tcp or udp' > $@

clean:
	$(RM) out/*
