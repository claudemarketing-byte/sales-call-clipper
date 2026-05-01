#!/usr/bin/env bash
# Auto-pull wrapper. Called by cron every 10 minutes on the Mac Mini.
# Pulls the latest main into the working copy this script lives in.
# Logs to ~/.sales-clipper-autopull.log
#
# Designed to be self-contained — minimal PATH, no env assumptions.

set -uo pipefail

# Resolve the repo root from this script's location (works regardless of cwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find git — cron has a minimal PATH on macOS
GIT=""
for candidate in /opt/homebrew/bin/git /usr/local/bin/git /usr/bin/git; do
  if [ -x "$candidate" ]; then GIT="$candidate"; break; fi
done
if [ -z "$GIT" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] FATAL: git not found in known paths" >> "$HOME/.sales-clipper-autopull.log"
  exit 1
fi

LOG="$HOME/.sales-clipper-autopull.log"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

# Capture old HEAD so we can tell if anything actually changed
OLD_HEAD="$(cd "$REPO_DIR" && "$GIT" rev-parse HEAD 2>/dev/null || echo unknown)"

# Pull, capture output + exit code
PULL_OUTPUT="$(cd "$REPO_DIR" && "$GIT" pull --ff-only --quiet 2>&1)"
PULL_EXIT=$?

NEW_HEAD="$(cd "$REPO_DIR" && "$GIT" rev-parse HEAD 2>/dev/null || echo unknown)"

if [ "$PULL_EXIT" -ne 0 ]; then
  echo "[$TS] FAIL exit=$PULL_EXIT: $PULL_OUTPUT" >> "$LOG"
  exit "$PULL_EXIT"
fi

if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
  # Nothing new — keep log quiet (only log changes + failures to avoid spam)
  exit 0
fi

# Got new commits — log the change
SUBJECT="$(cd "$REPO_DIR" && "$GIT" log -1 --pretty=format:'%h %s' "$NEW_HEAD")"
echo "[$TS] PULLED $OLD_HEAD..$NEW_HEAD — $SUBJECT" >> "$LOG"
