#!/usr/bin/env bash

# Get the file to build from arguments
readonly FILE_TO_BUILD="$1"

# Rename the file to have a .js extension instead of .ts
readonly OUTPUT_FILE="${FILE_TO_BUILD%.ts}.js"

echo "Building ${FILE_TO_BUILD} into ${OUTPUT_FILE}..."

bun build --target=node --outfile="${OUTPUT_FILE}" --format=esm --production "${FILE_TO_BUILD}"
