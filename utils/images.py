"""Image conversion and cleanup utilities."""

import os
import re
import shutil
import subprocess
from pathlib import Path


def convert_to_webp(input_path, output_path, is_gif=False):
    """
    Convert an image to WebP format.

    Tries converters in order of reliability:
    1. gif2webp (for GIFs - Google's official tool)
    2. ImageMagick (magick or convert)
    3. FFmpeg

    Args:
        input_path: Path to source image
        output_path: Path for output WebP file
        is_gif: Whether the source is an animated GIF

    Returns:
        True if conversion succeeded, False otherwise
    """
    input_path = str(input_path)
    output_path = str(output_path)

    # For GIFs: use gif2webp (Google's official tool) - most reliable
    if is_gif and shutil.which('gif2webp'):
        try:
            result = subprocess.run(
                ['gif2webp', '-q', '80', '-m', '4', '-mixed', input_path, '-o', output_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode == 0:
                print("✓ GIF converted with gif2webp")
                return True
            else:
                print(f"gif2webp failed: {result.stderr}")
        except Exception as e:
            print(f"gif2webp conversion failed: {e}")

    # Try ImageMagick (prefer 'magick' for v7)
    magick_cmd = 'magick' if shutil.which('magick') else 'convert' if shutil.which('convert') else None
    if magick_cmd:
        try:
            if is_gif:
                # For GIFs: coalesce frames first, then convert
                result = subprocess.run(
                    [magick_cmd, input_path, '-coalesce', '-quality', '80', output_path],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
            else:
                result = subprocess.run(
                    [magick_cmd, input_path, '-resize', '1600x>', '-quality', '75', output_path],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            if result.returncode == 0:
                return True
            else:
                print(f"ImageMagick stderr: {result.stderr}")
        except Exception as e:
            print(f"ImageMagick conversion failed: {e}")

    # Try FFmpeg as last resort
    if shutil.which('ffmpeg'):
        try:
            if is_gif:
                result = subprocess.run(
                    ['ffmpeg', '-i', input_path,
                     '-vcodec', 'libwebp', '-lossless', '0',
                     '-compression_level', '4', '-q:v', '70',
                     '-loop', '0', '-an', '-vsync', '0',
                     output_path, '-y'],
                    capture_output=True,
                    text=True,
                    timeout=60
                )
            else:
                result = subprocess.run(
                    ['ffmpeg', '-i', input_path, '-vf', 'scale=1600:-1:flags=lanczos',
                     '-q:v', '75', output_path, '-y'],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
            if result.returncode == 0:
                return True
            else:
                print(f"FFmpeg stderr: {result.stderr}")
        except Exception as e:
            print(f"FFmpeg conversion failed: {e}")

    return False


def extract_image_paths(markdown, session_id):
    """
    Extract all image paths from markdown for a session.

    Handles both markdown syntax ![alt](url) and HTML <img src="url">.
    Normalizes URLs to relative paths (media/session-id/filename.webp).

    Args:
        markdown: The markdown content to search
        session_id: Session identifier for path matching

    Returns:
        Set of relative image paths found
    """
    normalized_images = set()

    # Pattern to match: media/session-id/filename.webp
    relative_path_pattern = rf'media/{session_id}/[^)\s"\']+\.webp'

    # Match markdown syntax: ![alt](url)
    markdown_matches = re.finditer(rf'!\[[^\]]*\]\(([^)]+)\)', markdown)
    for match in markdown_matches:
        url = match.group(1)
        path_match = re.search(relative_path_pattern, url)
        if path_match:
            normalized_images.add(path_match.group(0))

    # Match HTML syntax: <img src="url">
    html_matches = re.finditer(r'<img[^>]+src=["\']?([^"\'>]+)["\']?[^>]*>', markdown, re.IGNORECASE)
    for match in html_matches:
        url = match.group(1)
        path_match = re.search(relative_path_pattern, url)
        if path_match:
            normalized_images.add(path_match.group(0))

    return normalized_images


def cleanup_unused_images(old_markdown, new_markdown, session_id):
    """
    Delete images no longer referenced in markdown.

    Args:
        old_markdown: Previous markdown content
        new_markdown: Updated markdown content
        session_id: Session identifier

    Returns:
        Number of images deleted
    """
    old_images = extract_image_paths(old_markdown, session_id)
    new_images = extract_image_paths(new_markdown, session_id)

    to_delete = old_images - new_images
    deleted = 0

    for image_path in to_delete:
        try:
            image_file = Path(image_path)
            if image_file.exists():
                image_file.unlink()
                print(f"🗑️  Deleted unused image: {image_path}")
                deleted += 1
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"⚠️  Warning: Could not delete {image_path}: {e}")

    return deleted


def delete_image(image_path):
    """
    Delete a single image file safely.

    Args:
        image_path: Path to the image (must be in media/ and .webp)

    Returns:
        True if deleted, False otherwise
    """
    if image_path.startswith('media/') and image_path.endswith('.webp'):
        try:
            Path(image_path).unlink()
            print(f"🗑️  Deleted: {image_path}")
            return True
        except FileNotFoundError:
            pass
    return False
