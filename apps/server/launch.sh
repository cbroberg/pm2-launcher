#!/bin/bash
# Wrapper so PM2 spawns Bun directly (interpreter:"none") instead of
# routing through ProcessContainerForkBun.js, which require()s our entry
# file — incompatible with our ESM imports.
set -e
cd "$(dirname "$0")"
exec /Users/cb/.bun/bin/bun run src/index.ts
