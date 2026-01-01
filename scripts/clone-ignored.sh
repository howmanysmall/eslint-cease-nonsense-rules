#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
OVERWRITE=0

usage() {
	cat <<'EOF'
clone-ignored-from-main.sh
Copies gitignored files from the repo's MAIN worktree into the CURRENT worktree,
excluding common junk (node_modules, dist/build/out, caches, .git, etc).

Options:
  --dry-run     Print what would be copied
  --overwrite   Overwrite existing files in destination
  -h, --help    Show help
EOF
}

while (($#)); do
	case "$1" in
	--dry-run)
		DRY_RUN=1
		shift
		;;
	--overwrite)
		OVERWRITE=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Unknown arg: $1" >&2
		usage >&2
		exit 2
		;;
	esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	echo "Not inside a Git worktree." >&2
	exit 1
fi

DEST_ROOT="$(cd "$(git rev-parse --show-toplevel)" && pwd)"

# Find main worktree (the one with a real .git directory).
MAIN_ROOT=""
while IFS= read -r line; do
	case "$line" in
	worktree\ *)
		wt="${line#worktree }"
		if [[ -d "$wt/.git" ]]; then
			MAIN_ROOT="$(cd "$wt" && pwd)"
			break
		fi
		;;
	esac
done < <(git worktree list --porcelain)

if [[ -z "$MAIN_ROOT" ]]; then
	echo "Could not determine main worktree path." >&2
	exit 1
fi

if [[ "$MAIN_ROOT" == "$DEST_ROOT" ]]; then
	echo "You are in the main worktree already; nothing to copy." >&2
	exit 1
fi

# Hard prefilter: never allow these paths into the rsync file list.
should_skip() {
	local rel="$1"
	case "$rel" in
	.git | .git/* | */.git | */.git/*) return 0 ;;
	node_modules | node_modules/* | */node_modules | */node_modules/*) return 0 ;;
	dist | dist/* | */dist | */dist/*) return 0 ;;
	build | build/* | */build | */build/*) return 0 ;;
	out | out/* | */out | */out/*) return 0 ;;
	.next | .next/* | */.next | */.next/*) return 0 ;;
	.turbo | .turbo/* | */.turbo | */.turbo/*) return 0 ;;
	.cache | .cache/* | */.cache | */.cache/*) return 0 ;;
	.parcel-cache | .parcel-cache/* | */.parcel-cache | */.parcel-cache/*) return 0 ;;
	.vite | .vite/* | */.vite | */.vite/*) return 0 ;;
	coverage | coverage/* | */coverage | */coverage/*) return 0 ;;
	.nyc_output | .nyc_output/* | */.nyc_output | */.nyc_output/*) return 0 ;;
	**/.DS_Store) return 0 ;;
	*.log | */*.log | */*/*.log | */*/*/*.log) return 0 ;; # cheap-but-effective
	esac
	return 1
}

# IMPORTANT: enumerate ignored files from SOURCE (main), not destination.
mapfile -d '' IGNORED < <(git -C "$MAIN_ROOT" ls-files -z -o -i --exclude-standard)

if ((${#IGNORED[@]} == 0)); then
	echo "No ignored files found in main worktree."
	exit 0
fi

TMP_LIST="$(mktemp)"
cleanup() { rm -f "$TMP_LIST"; }
trap cleanup EXIT

COUNT=0
for rel in "${IGNORED[@]}"; do
	if should_skip "$rel"; then
		continue
	fi
	printf '%s\0' "$rel" >>"$TMP_LIST"
	((COUNT++)) || true
done

if ((COUNT == 0)); then
	echo "Ignored files exist in main worktree, but all were excluded by filters."
	exit 0
fi

RSYNC_ARGS=(-a --from0 --files-from="$TMP_LIST")
if ((OVERWRITE == 0)); then
	RSYNC_ARGS+=(--ignore-existing)
fi
if ((DRY_RUN)); then
	RSYNC_ARGS+=(--dry-run -v)
fi

echo "SRC (main worktree): $MAIN_ROOT"
echo "DEST (current):      $DEST_ROOT"
echo "Paths selected:      $COUNT"
echo "Mode:                $([[ $DRY_RUN -eq 1 ]] && echo dry-run || echo copy), $([[ $OVERWRITE -eq 1 ]] && echo overwrite || echo no-overwrite)"

rsync "${RSYNC_ARGS[@]}" "$MAIN_ROOT"/ "$DEST_ROOT"/
