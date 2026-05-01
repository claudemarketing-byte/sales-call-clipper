#!/usr/bin/env bash
# One-time installer. Run on the Mac Mini once after cloning the repo.
# Adds a crontab entry that runs scripts/auto-pull.sh every 10 minutes.
#
# Idempotent — safe to run multiple times. Detects an existing entry via
# the "# sales-clipper-autopull" marker comment.
#
# Usage:
#   bash scripts/install-auto-pull.sh                # install
#   bash scripts/install-auto-pull.sh --uninstall    # remove

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PULL_SCRIPT="$SCRIPT_DIR/auto-pull.sh"
MARKER="# sales-clipper-autopull"
LOG="$HOME/.sales-clipper-autopull.log"

if [ ! -x "$PULL_SCRIPT" ]; then
  chmod +x "$PULL_SCRIPT"
fi

# --uninstall path
if [ "${1:-}" = "--uninstall" ]; then
  if ! crontab -l 2>/dev/null | grep -Fq "$MARKER"; then
    echo "auto-pull is not installed (no crontab line containing '$MARKER')"
    exit 0
  fi
  crontab -l 2>/dev/null | grep -Fv "$MARKER" | crontab -
  echo "uninstalled. Log preserved at $LOG."
  exit 0
fi

# Already installed?
if crontab -l 2>/dev/null | grep -Fq "$MARKER"; then
  echo "auto-pull is already installed."
  echo ""
  echo "Existing crontab line:"
  crontab -l 2>/dev/null | grep -F "$MARKER"
  echo ""
  echo "To reinstall: bash scripts/install-auto-pull.sh --uninstall && bash scripts/install-auto-pull.sh"
  exit 0
fi

CRON_LINE="*/10 * * * * /bin/bash $PULL_SCRIPT $MARKER"

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo "installed."
echo ""
echo "Watching: $REPO_DIR"
echo "Cadence:  every 10 minutes"
echo "Logs to:  $LOG  (only changes + failures, not silent runs)"
echo ""
echo "Verify:    crontab -l | grep autopull"
echo "Tail log:  tail -f $LOG"
echo "Uninstall: bash scripts/install-auto-pull.sh --uninstall"
echo ""
echo "NOTE: macOS Sonoma+ may require Full Disk Access for /usr/sbin/cron."
echo "If pulls don't fire, check System Settings → Privacy & Security → Full Disk Access"
echo "and add /usr/sbin/cron."
