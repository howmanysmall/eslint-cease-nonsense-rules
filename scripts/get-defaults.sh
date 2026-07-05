#!/usr/bin/env bash
flags=() paths=()
for a; do [[ $a == -* ]] && flags+=("$a") || paths+=("$a"); done
[[ ${#paths[@]} -eq 0 ]] && paths=(./src)
echo "${flags[*]} ${paths[*]}"
