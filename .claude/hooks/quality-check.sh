#!/usr/bin/env bash

set -euo pipefail

function run-check() {
	local name="$1"
	local cmd="$2"
	echo "🔍 Running ${name}..."
	if ! ${cmd}; then
		echo "❌ ${name} failed - blocking Claude"
		exit 2
	fi
	echo "✅ ${name} passed"
}

run-check "Format (auto-fix)" "nr format"
run-check "Lint" "nr lint:agent"
run-check "Type check" "nr type-check"
# run-check "Tests" "AGENT=1 nr test"

echo "🎉 All quality checks passed - codebase is clean!"
exit 0
