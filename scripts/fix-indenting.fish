#!/usr/bin/env fish

set -l testFiles (fd --glob 'tests/**/*.test.{ts,tsx}')
while rg -l '^[ ]*\t' $testFiles >/dev/null
    sd '^([ ]*)\t' '$1    ' $testFiles
end

aube run format tests
