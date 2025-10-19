#!/usr/bin/env bash

set -euo pipefail

function run-check() {
	local name="$1"
	local cmd="$2"
	echo "🔍 Running $name..."
	if ! $cmd; then
		echo "❌ $name failed - blocking Claude"
		exit 2
	fi
	echo "✅ $name passed"
}

run-check "Format (auto-fix)" "bun run format"
run-check "Lint" "bun run lint"
run-check "Type check" "bun run typecheck"
run-check "Tests" "bun run test"

echo "🎉 All quality checks passed - codebase is clean!"
exit 0
