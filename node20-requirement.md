---
name: node20-requirement
description: Project requires Node 20 — do not use Node 16
type: reference
---

# Node.js Version Requirement

This project requires **Node 20** minimum. Node 16 is not supported.

**Why:** Vitest 4.x and other dependencies use `node:util` exports (e.g., `styleText`) that don't exist in Node 16.

## How to Ensure Node 20 Is Used

### Per-session
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
```

### Persistent default
```bash
echo "20" > .nvmrc
nvm alias default 20
```

### Verify
```bash
node --version  # should show v20.x.x
npm test        # vitest should run (not crash with SyntaxError)
npm run build   # should compile cleanly
```

## `.nvmrc` file
- [x] Created `.nvmrc` with content: `20`