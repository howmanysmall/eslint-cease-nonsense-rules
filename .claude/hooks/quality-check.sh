#!/usr/bin/env bash

set -euo pipefail

function run-check() {
	local name="$1"
	shift
	echo "🔍 Running ${name} on ${rel_path}..."
	if ! "$@"; then
		echo "❌ ${name} failed - blocking Claude"
		exit 2
	fi
	echo "✅ ${name} passed"
}

input="$(cat)"
file_path="$(jq -r '.tool_input.file_path // empty' <<< "${input}")"

[[ -z "${file_path}" || ! -f "${file_path}" ]] && exit 0

case "${file_path}" in
	*.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) ;;
	*) exit 0 ;;
esac

rel_path="${file_path#"${PWD}"/}"

run-check "Format (auto-fix)" node --run format -- "${rel_path}"
run-check "Lint" node --run lint:agent -- "${rel_path}"

echo "🎉 Quality checks passed for ${rel_path}"
exit 0
