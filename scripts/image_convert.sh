#!/bin/bash

# Image Converter for GrowthLab Viewer
#
# Converts raw images from media_raw/session-XX/ to optimized WebP images
# in media/session-XX/ using ImageMagick or FFmpeg.
#
# Usage:
#   bash scripts/image_convert.sh session-01
#   or: ./scripts/image_convert.sh session-02
#
# Prerequisites:
#   - ImageMagick (convert command), OR
#   - FFmpeg (ffmpeg command)
#
# Examples to install:
#   macOS:  brew install imagemagick
#   Ubuntu: sudo apt-get install imagemagick
#   Or: brew install ffmpeg

set -e

RAW_ROOT="media_raw"
OUT_ROOT="media"
MAX_WIDTH=1600
QUALITY=75

# Check for required tool
if command -v convert &> /dev/null; then
  TOOL="imagemagick"
elif command -v ffmpeg &> /dev/null; then
  TOOL="ffmpeg"
else
  echo "Error: Neither ImageMagick nor FFmpeg found."
  echo "Install one:"
  echo "  macOS:  brew install imagemagick"
  echo "  Ubuntu: sudo apt-get install imagemagick"
  exit 1
fi

if [ -z "$1" ]; then
  echo "Usage: bash scripts/image_convert.sh SESSION_ID"
  echo "Example: bash scripts/image_convert.sh session-01"
  exit 1
fi

SESSION_ID="$1"
INPUT_DIR="$RAW_ROOT/$SESSION_ID"
OUTPUT_DIR="$OUT_ROOT/$SESSION_ID"

if [ ! -d "$INPUT_DIR" ]; then
  echo "Error: Directory not found: $INPUT_DIR"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "Converting images from $INPUT_DIR (using $TOOL)..."
echo ""

count=0
for file in "$INPUT_DIR"/*; do
  [ -f "$file" ] || continue

  ext="${file##*.}"
  ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

  # Skip non-image files
  case "$ext_lower" in
    png|jpg|jpeg|gif|bmp|tiff) ;;
    *)
      echo "⊘ Skipping: $(basename "$file") (unsupported format)"
      continue
      ;;
  esac

  filename=$(basename "$file")
  basename_noext="${filename%.*}"
  output_file="$OUTPUT_DIR/${basename_noext}.webp"

  if [ "$TOOL" = "imagemagick" ]; then
    # Use ImageMagick
    convert "$file" \
      -resize "${MAX_WIDTH}x>" \
      -quality "$QUALITY" \
      "$output_file"
  else
    # Use FFmpeg
    ffmpeg -i "$file" \
      -vf "scale=${MAX_WIDTH}:-1" \
      -q:v 5 \
      "$output_file" \
      -y 2>/dev/null
  fi

  if [ -f "$output_file" ]; then
    in_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "?")
    out_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "?")

    if [ "$in_size" != "?" ] && [ "$out_size" != "?" ]; then
      saved=$(( (in_size - out_size) * 100 / in_size ))
      echo "✓ $filename → ${basename_noext}.webp (saved ${saved}%)"
    else
      echo "✓ $filename → ${basename_noext}.webp"
    fi
    count=$((count + 1))
  else
    echo "✗ Failed to convert $filename"
  fi
done

echo ""
echo "Conversion complete! Converted $count images to $OUTPUT_DIR/"
