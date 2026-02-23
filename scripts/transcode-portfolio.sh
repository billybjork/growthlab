#!/bin/bash
# transcode-portfolio.sh - Process all portfolio assets
# Run from src directory: ./scripts/transcode-portfolio.sh

set -e

SRC="/Users/billy/Downloads/growthlab"
DEST="public/media/portfolio"

# Check source directory exists
if [ ! -d "$SRC" ]; then
    echo "Error: Source directory not found: $SRC"
    exit 1
fi

# Create destination directories
mkdir -p "$DEST/01-betterhelp" "$DEST/02-hungryroot"

echo "Processing hero video..."
# Hero video (~47MB -> ~8MB)
ffmpeg -i "$SRC/main.mp4" -c:v libvpx-vp9 -b:v 1M -crf 30 -vf "scale=1920:-2" -an -y "$DEST/hero.webm"
ffmpeg -i "$SRC/main.mp4" -c:v libx264 -preset slow -crf 26 -vf "scale=1920:-2" -movflags +faststart -an -y "$DEST/hero.mp4"
ffmpeg -i "$SRC/main.mp4" -ss 00:00:05 -vframes 1 -y "$DEST/hero-poster.jpg"
magick "$DEST/hero-poster.jpg" -quality 85 "$DEST/hero-poster.webp"
rm "$DEST/hero-poster.jpg"

echo "Processing 01-betterhelp assets..."

# BetterHelp videos
for video in "$SRC/01-betterhelp"/*.mp4; do
    [ -f "$video" ] || continue
    base=$(basename "$video" .mp4)
    # Simplify filename
    simple_name=$(echo "$base" | sed 's/ai-bootcamp-example_betterhelp_//')
    echo "  Processing video: $simple_name"
    ffmpeg -i "$video" -c:v libvpx-vp9 -b:v 800k -crf 32 -vf "scale=1280:-2" -an -y "$DEST/01-betterhelp/$simple_name.webm"
    ffmpeg -i "$video" -c:v libx264 -preset medium -crf 28 -vf "scale=1280:-2" -movflags +faststart -an -y "$DEST/01-betterhelp/$simple_name.mp4"
    # Generate poster from first frame
    ffmpeg -i "$video" -vframes 1 -y "$DEST/01-betterhelp/$simple_name-poster.jpg"
    magick "$DEST/01-betterhelp/$simple_name-poster.jpg" -quality 75 "$DEST/01-betterhelp/$simple_name-poster.webp"
    rm "$DEST/01-betterhelp/$simple_name-poster.jpg"
done

# BetterHelp images -> WebP (max 1600px, quality 75)
for img in "$SRC/01-betterhelp"/*.png "$SRC/01-betterhelp"/*.jpg "$SRC/01-betterhelp"/*.jpeg; do
    [ -f "$img" ] || continue
    base=$(basename "$img")
    ext="${base##*.}"
    name="${base%.*}"
    # Simplify filename
    simple_name=$(echo "$name" | sed 's/ai-bootcamp-example_betterhelp_//')
    echo "  Processing image: $simple_name"
    magick "$img" -resize 1600x\> -quality 75 "$DEST/01-betterhelp/$simple_name.webp"
done

echo "Processing 02-hungryroot assets..."

# Hungryroot videos
for video in "$SRC/02-hungryroot"/*.mp4; do
    [ -f "$video" ] || continue
    base=$(basename "$video" .mp4)
    # Simplify filename - extract person name and type
    simple_name=$(echo "$base" | sed 's/[^a-zA-Z0-9_-]/_/g' | tr '[:upper:]' '[:lower:]')
    echo "  Processing video: $simple_name"
    ffmpeg -i "$video" -c:v libvpx-vp9 -b:v 800k -crf 32 -vf "scale=1280:-2" -an -y "$DEST/02-hungryroot/$simple_name.webm"
    ffmpeg -i "$video" -c:v libx264 -preset medium -crf 28 -vf "scale=1280:-2" -movflags +faststart -an -y "$DEST/02-hungryroot/$simple_name.mp4"
    # Generate poster from first frame
    ffmpeg -i "$video" -vframes 1 -y "$DEST/02-hungryroot/$simple_name-poster.jpg"
    magick "$DEST/02-hungryroot/$simple_name-poster.jpg" -quality 75 "$DEST/02-hungryroot/$simple_name-poster.webp"
    rm "$DEST/02-hungryroot/$simple_name-poster.jpg"
done

# Hungryroot images -> WebP (max 1600px, quality 75)
for img in "$SRC/02-hungryroot"/*.png "$SRC/02-hungryroot"/*.jpg "$SRC/02-hungryroot"/*.jpeg; do
    [ -f "$img" ] || continue
    base=$(basename "$img")
    ext="${base##*.}"
    name="${base%.*}"
    # Simplify filename
    simple_name=$(echo "$name" | sed 's/[^a-zA-Z0-9_-]/_/g' | tr '[:upper:]' '[:lower:]')
    echo "  Processing image: $simple_name"
    magick "$img" -resize 1600x\> -quality 75 "$DEST/02-hungryroot/$simple_name.webp"
done

echo ""
echo "Done! Assets processed to $DEST"
echo ""
echo "Next step: Update public/content/portfolio/config.json with the asset metadata"
