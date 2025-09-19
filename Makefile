SHELL := /bin/bash
DATE := $(shell date +"%Y-%m-%d")
MONTH := $(shell date +"%Y-%m")

dev:
	cargo run -p opencode_pm

check:
	cargo fmt --all -- --check
	cargo clippy --all-targets --all-features -- -D warnings
	cargo test --all

log-today:
	mkdir -p docs/logs/$(MONTH)
	@test -f docs/logs/$(MONTH)/log-$(DATE).md || \
	( echo "# $(DATE)" > docs/logs/$(MONTH)/log-$(DATE).md && \
	  echo -e "\n## Inputs\n\n## Decisions\n\n## Tasks Moved\n\n## Events\n\n## Links" >> docs/logs/$(MONTH)/log-$(DATE).md && \
	  echo "Created docs/logs/$(MONTH)/log-$(DATE).md" )

validate-contracts:
	python3 scripts/validate_contracts.py

sidecar:
	python3 -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements.txt && \
	uvicorn scripts.sidecar_app:app --host 0.0.0.0 --port 8079

archive-toc:
	@echo "# ARCHIVE" > docs/ARCHIVE.md && \
	echo -e "\n> Master index of logs & design decisions.\n" >> docs/ARCHIVE.md && \
	find docs/logs -name "log-*.md" | sort | awk '{print "- [" $$1 "](" $$1 ")"}' >> docs/ARCHIVE.md && \
	echo "ARCHIVE.md rebuilt."

.PHONY: dev check log-today validate-contracts archive-toc