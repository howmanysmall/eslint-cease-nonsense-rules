#!/usr/bin/env bash

# Local CI Script
# Usage:
#   ./scripts/local-ci.sh                    # Run all tests at once
#   TEST_SHARDS=4 ./scripts/local-ci.sh      # Run tests across 4 shards
#   TEST_SHARDS=8 ./scripts/local-ci.sh      # Run tests across 8 shards

function install() {
	echo "Running 'Install' Step"
	bun ci
}
function setup-oxlint-tsgolint() {
	echo "Running 'Setup oxlint-tsgolint' Step"
	bun add -D oxlint-tsgolint@latest
}
function lint() {
	echo "Running 'Lint' Step"
	bun run lint
}
function biome-ci() {
	echo "Running 'Biome CI' Step"
	bun run biome:ci
}
function knip() {
	echo "Running 'Knip' Step"
	bun run knip
}
function type-checking() {
	echo "Running 'Type Checking' Step"
	bun run type-check
}
function test() {
	echo "Running 'Test' Step"
	local TEST_SHARDS="${TEST_SHARDS:-1}"

	if [[ "${TEST_SHARDS}" -eq 1 ]]; then
		# Run all tests at once (default behavior)
		AGENT=1 bun run test --bail
	else
		# Run tests in shards locally
		echo "Running tests across ${TEST_SHARDS} shards..."
		local failed=0

		for shard in $(seq 1 "${TEST_SHARDS}"); do
			echo "Running shard ${shard}/${TEST_SHARDS}..."
			SHARD_FILES=$(bun run ./scripts/shard-tests.ts "${shard}" "${TEST_SHARDS}")

			if [[ -n "${SHARD_FILES}" ]]; then
				# Don't quote SHARD_FILES so bash splits it into separate arguments
				if ! AGENT=1 bun run test --bail ${SHARD_FILES}; then
					echo "Shard ${shard} failed"
					failed=1
				fi
			else
				echo "Shard ${shard} has no test files (empty shard)"
			fi
		done

		if [[ ${failed} -eq 1 ]]; then
			echo "One or more test shards failed"
			return 1
		fi

		echo "All ${TEST_SHARDS} shards passed"
	fi
}
function build() {
	echo "Running 'Build' Step"
	bun run build
}

install
setup-oxlint-tsgolint
lint
biome-ci
knip
type-checking
test
build
