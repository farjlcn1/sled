#!/usr/bin/env bash
# Namesti sledenje-billing.timer, ki 1x mesečno (1. v mesecu, 03:00) sproži mesečni obračun
# zaračunavanja (glej scripts/monthly-billing.ts). Zaženi z: sudo bash deploy/billing/setup.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp "$SCRIPT_DIR/sledenje-billing.service" /etc/systemd/system/sledenje-billing.service
cp "$SCRIPT_DIR/sledenje-billing.timer" /etc/systemd/system/sledenje-billing.timer
systemctl daemon-reload
systemctl enable --now sledenje-billing.timer

echo "--- stanje timerja ---"
systemctl list-timers sledenje-billing.timer --no-pager
