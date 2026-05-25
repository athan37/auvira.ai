.PHONY: dev dev-wait

## Run Next.js dev server (same as npm run dev)
dev:
	npm run dev

## Wait until http://localhost:3000 responds (60s default)
dev-wait:
	npm run dev:wait
