#!/usr/bin/env bash
# Namesti sledenje-private-mode.timer, ki redno (vsakih 5 min) sinhronizira zasebni način vozil po
# nastavljenem DIN (glej scripts/private-mode-sync.ts). Zaženi z: sudo bash deploy/private-mode/setup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp "$SCRIPT_DIR/sledenje-private-mode.service" /etc/systemd/system/sledenje-private-mode.service
cp "$SCRIPT_DIR/sledenje-private-mode.timer" /etc/systemd/system/sledenje-private-mode.timer
systemctl daemon-reload
systemctl enable --now sledenje-private-mode.timer

echo "--- stanje timerja ---"
systemctl list-timers sledenje-private-mode.timer --no-pager
