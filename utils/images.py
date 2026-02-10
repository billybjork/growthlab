"""Image conversion and cleanup utilities."""

import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path


MANIFEST_FILENAME = '.image-hashes.json'
SHARED_MEDIA_DIR = 'media/shared'


def compute_file_hash(file_path):
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def load_hash_manifest(session_dir):
    """Load hash manifest for a session directory."""
    manifest_path = Path(session_dir) / MANIFEST_FILENAME
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def save_hash_manifest(session_dir, manifest):
    """Save hash manifest for a session directory."""
    manifest_path = Path(session_dir) / MANIFEST_FILENAME
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)


def find_duplicate(file_path, session_dir):
    """
    Check if a file already exists in the session directory by hash.

    Returns:
        tuple: (is_duplicate, existing_filename or None)
    """
    file_hash = compute_file_hash(file_path)
    manifest = load_hash_manifest(session_dir)

    if file_hash in manifest:
        existing_file = manifest[file_hash]
        # Verify the file still exists
        if (Path(session_dir) / existing_file).exists():
            return True, existing_file, file_hash

    return False, None, file_hash


def register_image_hash(session_dir, filename, file_hash):
    """Register a new image hash in the manifest."""
    manifest = load_hash_manifest(session_dir)
    manifest[file_hash] = filename
    save_hash_manifest(session_dir, manifest)


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


def extract_image_paths(markdown, session_id=None):
    """
    Extract all image paths from markdown.

    Handles both markdown syntax ![alt](url) and HTML <img src="url">.
    Normalizes URLs to relative paths (media/shared/filename.webp).

    Args:
        markdown: The markdown content to search
        session_id: Deprecated, kept for backward compatibility (unused)

    Returns:
        Set of relative image paths found
    """
    normalized_images = set()

    # Pattern to match: media/shared/filename.webp
    relative_path_pattern = r'media/shared/[^)\s"\']+\.webp'

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


def get_all_session_files():
    """
    Get all markdown session files across all cohorts.

    Returns:
        List of Path objects to all session markdown files
    """
    cohorts_dir = Path('content')
    session_files = []

    if cohorts_dir.exists():
        for cohort_dir in cohorts_dir.iterdir():
            if cohort_dir.is_dir():
                sessions_dir = cohort_dir / 'sessions'
                if sessions_dir.exists():
                    session_files.extend(sessions_dir.glob('*.md'))

    return session_files


def is_image_used_anywhere(image_path):
    """
    Check if an image is referenced in any session file across all cohorts.

    Args:
        image_path: The image path to check (e.g., 'media/shared/filename.webp')

    Returns:
        True if the image is used in any session file
    """
    for session_file in get_all_session_files():
        try:
            content = session_file.read_text(encoding='utf-8')
            if image_path in content:
                return True
        except Exception:
            pass
    return False


def cleanup_unused_images(old_markdown, new_markdown, session_id=None):
    """
    Delete images no longer referenced in markdown.

    Only deletes images if they are not used in ANY session file across all cohorts,
    since images are stored in a shared folder.

    Args:
        old_markdown: Previous markdown content
        new_markdown: Updated markdown content
        session_id: Deprecated, kept for backward compatibility (unused)

    Returns:
        Number of images deleted
    """
    old_images = extract_image_paths(old_markdown)
    new_images = extract_image_paths(new_markdown)

    to_delete = old_images - new_images
    deleted = 0

    for image_path in to_delete:
        # Check if image is still used in ANY session before deleting
        if is_image_used_anywhere(image_path):
            print(f"⏭️  Keeping image (used elsewhere): {image_path}")
            continue

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


def delete_image(image_path, force=False):
    """
    Delete a single image file safely.

    Only deletes if the image is not used in any session file,
    unless force=True (for cleaning up freshly uploaded images that were never saved).

    Args:
        image_path: Path to the image (must be in media/shared/ and .webp)
        force: If True, skip the usage check (for newly uploaded images only)

    Returns:
        True if deleted, False otherwise
    """
    if image_path.startswith('media/shared/') and image_path.endswith('.webp'):
        # Safety check: don't delete images used elsewhere
        if not force and is_image_used_anywhere(image_path):
            print(f"⏭️  Keeping image (used elsewhere): {image_path}")
            return False

        try:
            Path(image_path).unlink()
            print(f"🗑️  Deleted: {image_path}")
            return True
        except FileNotFoundError:
            pass
    return False


def get_shared_media_dir():
    """
    Get the path to the shared media directory.

    Returns:
        Path object to the shared media directory
    """
    return Path(SHARED_MEDIA_DIR)
