#!/usr/bin/env bash
#
# Build native tools for the chrome extension.
# Currently only builds the play-alert-sound Swift binary.
#
# This script must be run outside the nix shell to access system Swift.
#
# Usage:
#   ./scripts/build-native-tools.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# Only build on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Native tools are only built on macOS (skipping)"
    exit 0
fi

# Check if Swift is available
if ! command -v swiftc &> /dev/null; then
    echo "Warning: swiftc not found, skipping native tool build"
    exit 0
fi

TOOLS_DIR="hooks/chrome/native"
OUTPUT_DIR="bin"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build play-alert-sound if source is newer than binary
SOURCE_FILE="$TOOLS_DIR/play-alert-sound.swift"
OUTPUT_FILE="$OUTPUT_DIR/play-alert-sound"

if [[ ! -f "$OUTPUT_FILE" || "$SOURCE_FILE" -nt "$OUTPUT_FILE" ]]; then
    echo "Building play-alert-sound..."

    # Build outside nix shell with clean environment
    # This ensures we use the system Swift, not nix Swift
    env -i \
        HOME="$HOME" \
        PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
        /usr/bin/swiftc -O "$SOURCE_FILE" -o "$OUTPUT_FILE"

    echo "Built: $OUTPUT_FILE"
else
    echo "play-alert-sound is up to date"
fi

echo "Native tools build complete"
