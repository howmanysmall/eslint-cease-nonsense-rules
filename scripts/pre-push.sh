#!/usr/bin/env bash

# This is meant to simulate `ci.yaml`.

set -euo pipefail

bun run biome:ci
bun add -d oxlint-tsgolint@latest
bun run oxc .
bun run type-check
bun run knip
bun run build
