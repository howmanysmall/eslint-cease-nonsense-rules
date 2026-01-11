#!/usr/bin/env bash

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
    bun test --randomize
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
