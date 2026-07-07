#!/usr/bin/env bash

# Local CI Script
# Usage:
#   ./scripts/local-ci.sh                    # Run all tests at once
#   TEST_SHARDS=4 ./scripts/local-ci.sh      # Run tests across 4 shards
#   TEST_SHARDS=8 ./scripts/local-ci.sh      # Run tests across 8 shards

function install() {
	echo "Running 'Install' Step"
	nci
}
function setup-oxlint-tsgolint() {
	echo "Running 'Setup oxlint-tsgolint' Step"
	ni -D oxlint-tsgolint@latest
}
function lint() {
	echo "Running 'Lint' Step"
	nr lint
}
function biome-ci() {
	echo "Running 'Biome CI' Step"
	nr biome ci
}
function knip() {
	echo "Running 'Knip' Step"
	nr knip
}
function type-checking() {
	echo "Running 'Type Checking' Step"
	nr type-check
}
function test() {
	echo "Running 'Test' Step"
	local TEST_SHARDS="${TEST_SHARDS:-1}"

	if [[ "${TEST_SHARDS}" -eq 1 ]]; then
		# Run all tests at once (default behavior)
		AGENT=1 nr test -- --bail
	else
		# Run tests in shards locally
		echo "Running tests across ${TEST_SHARDS} shards..."
		local HEAVY_TEST_SHARDS="${HEAVY_TEST_SHARDS:-4}"
		local failed=0

		for shard in $(seq 1 "${TEST_SHARDS}"); do
			echo "Running shard ${shard}/${TEST_SHARDS}..."
			SHARD_FILES=$(./scripts/shard-tests.ts --normal-lane "${shard}" "${TEST_SHARDS}")

			if [[ -n "${SHARD_FILES}" ]]; then
				# Don't quote SHARD_FILES so bash splits it into separate arguments
				if ! AGENT=1 nr test -- --bail ${SHARD_FILES}; then
					echo "Shard ${shard} failed"
					failed=1
				fi
			else
				echo "Shard ${shard} has no test files (empty shard)"
			fi
		done

		while IFS= read -r heavy_file; do
			[[ -z "${heavy_file}" ]] && continue
			for case_shard in $(seq 1 "${HEAVY_TEST_SHARDS}"); do
				echo "Running heavy ${heavy_file} case shard ${case_shard}/${HEAVY_TEST_SHARDS}..."
				if ! TEST_CASE_SHARD="${case_shard}/${HEAVY_TEST_SHARDS}" AGENT=1 nr test -- --bail "${heavy_file}"; then
					echo "Heavy test ${heavy_file} case shard ${case_shard} failed"
					failed=1
				fi
			done
		done < <(bun -e 'import { getHeavyFiles } from "./scripts/test-shard-plan.ts"; process.stdout.write(getHeavyFiles().join("\n") + "\n")')

		if [[ ${failed} -eq 1 ]]; then
			echo "One or more test shards failed"
			return 1
		fi

		echo "All ${TEST_SHARDS} shards passed"
	fi
}
function build() {
	echo "Running 'Build' Step"
	nr build
}

install
setup-oxlint-tsgolint
lint
biome-ci
knip
type-checking
test
build
