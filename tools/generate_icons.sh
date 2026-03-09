#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ICON_DIR="$SCRIPT_DIR/../local_app/icons"
mkdir -p "$ICON_DIR"

# Regular icons
rsvg-convert -w 16 -h 16 "$SCRIPT_DIR/icon-source.svg" -o "$ICON_DIR/favicon-16.png"
rsvg-convert -w 32 -h 32 "$SCRIPT_DIR/icon-source.svg" -o "$ICON_DIR/favicon-32.png"
rsvg-convert -w 180 -h 180 "$SCRIPT_DIR/icon-source.svg" -o "$ICON_DIR/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 "$SCRIPT_DIR/icon-source.svg" -o "$ICON_DIR/icon-192.png"
rsvg-convert -w 512 -h 512 "$SCRIPT_DIR/icon-source.svg" -o "$ICON_DIR/icon-512.png"

# Maskable icon
rsvg-convert -w 512 -h 512 "$SCRIPT_DIR/icon-maskable-source.svg" -o "$ICON_DIR/icon-maskable-512.png"

echo "Icons generated successfully."
