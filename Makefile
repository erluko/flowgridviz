.PHONY: tidy clean

ifndef input_mode
$(error "Run this makefile via npm: 'npm run make' or 'npm install'")
endif

all: input services
services: out/services.js
input: data/input.json

out/%.js: templates/jsonwrapper.js data/%.json
	sed -n -e 's/INSERT_KEY_NAME_HERE/$(notdir $(basename $@))/' -e '/^ *\/\/INSERT_DATA_HERE$$/! p' -e '/^ *\/\/INSERT_DATA_HERE$$/ r $(filter-out %.js,$^)' < $< >$@

data/input.json: input/sample-input.json data/sample-flows.gz
	cp $< $@

data/sample-flows.gz: input/sample-flows.gz
	cp $< $@

data/services.json: $(npm_package_config_services_file)
	tr '\t' ' ' < $< | sed -n -e 's/^\([^#][^ $(TAB)]\{1,\}\)[ $(TAB)]\{1,\}\([0-9]\{1,\}\)\/.*$$/[\2,"\1"],/p' | sort -unk1.2 > $@

tidy:
	$(RM) out/*

clean: tidy
	$(RM) data/*
