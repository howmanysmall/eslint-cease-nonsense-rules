#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
	echo "This script must be run inside a git repository."
	exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "Please start from a clean working tree."
	exit 1
fi

tag_name=$(git describe --tags --exact-match HEAD 2> /dev/null || true)
if [[ -z "${tag_name}" ]]; then
	echo "HEAD is not tagged, so there is no release commit to undo."
	exit 1
fi

commit_subject=$(git log -1 --format=%s HEAD)
printf 'About to revert %s (%s)\n' "${tag_name}" "${commit_subject}"
read -r -p "Proceed with the revert and tag delete? [y/N] " answer

case "${answer}" in
	y | Y | yes | YES)
		git revert --no-edit HEAD
		git tag -d "${tag_name}"
		printf 'Reverted %s and deleted the local tag.\n' "${tag_name}"
		;;
	*)
		echo "Aborted."
		exit 1
		;;
esac
