.PHONY: adk-agent adk-agent-install dev

ADK_PORT ?= 8001

## Start the ADK owner website edit agent (Python FastAPI on :8001)
adk-agent: adk-agent-install
	cd adk-coding-agent && \
	. .venv/bin/activate && \
	PROJECT_WEBSITE_AGENT_ENABLED=true \
	uvicorn server:app --host 0.0.0.0 --port $(ADK_PORT) --reload

## Install Python dependencies for the ADK coding agent
adk-agent-install:
	cd adk-coding-agent && \
	([ -d .venv ] || python3 -m venv .venv) && \
	. .venv/bin/activate && pip install -q -r requirements.txt

## Run Next.js dev server (same as npm run dev)
dev:
	npm run dev
