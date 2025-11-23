#!/usr/bin/env python3
"""
GrowthLab Dev Server
Zero-dependency Python HTTP server for local development with editing capabilities.
Replaces: python3 -m http.server

Usage:
    python3 server.py [port]
    Default port: 8000
"""

import http.server
import socketserver
import json
import urllib.parse
import io
import os
import re
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from email import message_from_binary_file
from email.message import Message


def extract_image_paths(markdown, session_id):
    """Extract all image paths from markdown for this session (both markdown and HTML syntax)."""
    # Match markdown syntax: ![alt](media/session-id/file.webp)
    markdown_pattern = rf'!\[.*?\]\((media/{session_id}/.*?\.webp)\)'
    markdown_images = set(re.findall(markdown_pattern, markdown))

    # Match HTML syntax: <img src="media/session-id/file.webp" ...>
    html_pattern = rf'<img[^>]+src=["\']?(media/{session_id}/.*?\.webp)["\']?[^>]*>'
    html_images = set(re.findall(html_pattern, markdown))

    # Return combined set of both formats
    return markdown_images | html_images


def cleanup_unused_images(old_markdown, new_markdown, session_id):
    """Delete images that are no longer referenced in the markdown."""
    old_images = extract_image_paths(old_markdown, session_id)
    new_images = extract_image_paths(new_markdown, session_id)

    # Images to delete = in old but not in new
    to_delete = old_images - new_images

    for image_path in to_delete:
        try:
            # Path is relative to public/ directory
            Path(image_path).unlink()
            print(f"🗑️  Deleted unused image: {image_path}")
        except FileNotFoundError:
            # Already deleted, no problem
            pass
        except Exception as e:
            print(f"⚠️  Warning: Could not delete {image_path}: {e}")

    return len(to_delete)


class GrowthLabHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler with API endpoints for image upload and markdown editing."""

    def do_GET(self):
        """Handle GET requests, with special handling for config.local.js."""
        parsed_path = urllib.parse.urlparse(self.path)

        # Dynamically serve config.local.js from environment variable if file doesn't exist
        if parsed_path.path == '/js/config.local.js':
            config_path = Path('js/config.local.js')

            # If file exists locally (development), serve it normally
            if config_path.exists():
                return super().do_GET()

            # Otherwise, generate from environment variable (production)
            webhook_url = os.environ.get('FORMS_WEBHOOK_URL', '')

            config_content = f"""/**
 * Production Configuration
 * Auto-generated from environment variables
 */
GROWTHLAB_CONFIG.FORMS_WEBHOOK_URL = '{webhook_url}';
"""

            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', len(config_content.encode()))
            self.end_headers()
            self.wfile.write(config_content.encode())
            return

        # Default behavior for all other requests
        return super().do_GET()

    def do_POST(self):
        """Handle POST requests for API endpoints."""
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == '/api/upload-image':
            self.handle_upload_image()
        elif parsed_path.path == '/api/update-card':
            self.handle_update_card()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_upload_image(self):
        """Handle image upload, conversion to WebP, and return the path."""
        temp_path = None
        try:
            # Check request size limit (10MB max)
            MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > MAX_IMAGE_SIZE:
                self.send_json_response(413, {'error': 'File too large (max 10MB)'})
                return

            # Parse multipart form data
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self.send_json_response(400, {'error': 'Invalid content type'})
                return

            # Parse multipart form using email.message (replaces deprecated cgi module)
            boundary = content_type.split('boundary=')[1].strip()
            parts = self._parse_multipart(boundary, content_length)

            # Get the uploaded file
            if 'image' not in parts:
                self.send_json_response(400, {'error': 'No image file provided'})
                return

            file_data = parts['image']
            if not file_data['data']:
                self.send_json_response(400, {'error': 'Empty file'})
                return

            # Get session ID
            session_id = parts.get('sessionId', {}).get('data', b'session-01').decode('utf-8')

            # Validate file extension
            filename = file_data['filename']
            ext = Path(filename).suffix.lower()
            allowed_exts = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'}
            if ext not in allowed_exts:
                self.send_json_response(400, {'error': f'Invalid file type: {ext}'})
                return

            # Create temp file for upload
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(file_data['data'])

            # Create output directory (relative to public/)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_dir = Path('media') / session_id
            output_dir.mkdir(parents=True, exist_ok=True)

            output_filename = f"{timestamp}.webp"
            output_path = output_dir / output_filename

            # Convert image directly using ImageMagick or FFmpeg
            conversion_successful = False

            # Try ImageMagick first
            if shutil.which('convert'):
                try:
                    result = subprocess.run(
                        ['convert', temp_path, '-resize', '1600x>', '-quality', '75', str(output_path)],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    if result.returncode == 0:
                        conversion_successful = True
                except Exception as e:
                    print(f"ImageMagick conversion failed: {e}")

            # Try FFmpeg if ImageMagick failed or not available
            if not conversion_successful and shutil.which('ffmpeg'):
                try:
                    result = subprocess.run(
                        ['ffmpeg', '-i', temp_path, '-vf', 'scale=1600:-1', '-q:v', '5', str(output_path), '-y'],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    if result.returncode == 0:
                        conversion_successful = True
                except Exception as e:
                    print(f"FFmpeg conversion failed: {e}")

            if not conversion_successful:
                self.send_json_response(500, {
                    'error': 'Image conversion failed',
                    'details': 'Neither ImageMagick nor FFmpeg available or conversion failed'
                })
                return

            # Verify the output file exists
            if not output_path.exists():
                self.send_json_response(500, {
                    'error': 'Converted image not found',
                    'details': f'Expected: {output_path}'
                })
                return

            # Return success with the image path
            self.send_json_response(200, {
                'success': True,
                'path': f"media/{session_id}/{output_filename}"
            })

        except subprocess.TimeoutExpired:
            self.send_json_response(500, {'error': 'Image conversion timeout'})
        except Exception as e:
            self.send_json_response(500, {'error': f'Upload error: {str(e)}'})
        finally:
            # Clean up temp file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    print(f"Warning: Failed to delete temp file: {e}")

    def handle_update_card(self):
        """Handle markdown file update for a specific card."""
        try:
            # Check request size limit (1MB max for markdown)
            MAX_MARKDOWN_SIZE = 1 * 1024 * 1024  # 1MB
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > MAX_MARKDOWN_SIZE:
                self.send_json_response(413, {'error': 'Markdown too large (max 1MB)'})
                return

            # Read JSON body
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            # Validate input
            session_file = data.get('sessionFile')
            card_index = data.get('cardIndex')
            new_content = data.get('content')

            if not session_file or card_index is None or new_content is None:
                self.send_json_response(400, {
                    'error': 'Missing required fields: sessionFile, cardIndex, content'
                })
                return

            # Validate session file path (security: prevent directory traversal)
            # Use basename to strip any path components, then validate with regex
            session_file = os.path.basename(session_file)
            if not re.match(r'^[a-zA-Z0-9_-]+$', session_file):
                self.send_json_response(400, {'error': 'Invalid session file name'})
                return

            # Read the markdown file (relative to public/)
            md_path = Path('sessions') / f"{session_file}.md"
            if not md_path.exists():
                self.send_json_response(404, {'error': 'Session file not found'})
                return

            with open(md_path, 'r', encoding='utf-8') as f:
                old_markdown = f.read()

            # Split into cards
            cards = old_markdown.split('\n---\n')

            # Validate card index
            if card_index < 0 or card_index >= len(cards):
                self.send_json_response(400, {'error': 'Invalid card index'})
                return

            # Update the specific card
            cards[card_index] = new_content

            # Join back together
            updated_markdown = '\n---\n'.join(cards)

            # Clean up unused images
            deleted_count = cleanup_unused_images(old_markdown, updated_markdown, session_file)
            if deleted_count > 0:
                print(f"✨ Cleaned up {deleted_count} unused image(s)")

            # Write back to file
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(updated_markdown)

            self.send_json_response(200, {'success': True})

        except json.JSONDecodeError:
            self.send_json_response(400, {'error': 'Invalid JSON'})
        except Exception as e:
            self.send_json_response(500, {'error': f'Update error: {str(e)}'})

    def _parse_multipart(self, boundary, content_length):
        """
        Parse multipart/form-data without using deprecated cgi module.
        Returns dict of {field_name: {'data': bytes, 'filename': str}}
        """
        # Read the entire body
        body = self.rfile.read(content_length)

        # Split by boundary
        boundary_bytes = f'--{boundary}'.encode()
        parts = body.split(boundary_bytes)

        result = {}
        for part in parts:
            if not part or part == b'--\r\n' or part == b'--':
                continue

            # Split headers from data
            if b'\r\n\r\n' not in part:
                continue

            headers_data = part.split(b'\r\n\r\n', 1)
            if len(headers_data) != 2:
                continue

            headers_bytes, data = headers_data

            # Parse Content-Disposition header
            headers_str = headers_bytes.decode('utf-8', errors='ignore')

            # Extract field name
            name_match = re.search(r'name="([^"]+)"', headers_str)
            if not name_match:
                continue

            field_name = name_match.group(1)

            # Extract filename if present
            filename_match = re.search(r'filename="([^"]+)"', headers_str)
            filename = filename_match.group(1) if filename_match else None

            # Remove trailing boundary markers
            data = data.rstrip(b'\r\n')

            result[field_name] = {
                'data': data,
                'filename': filename
            }

        return result

    def send_json_response(self, status_code, data):
        """Send a JSON response."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        """Add CORS headers to all responses."""
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def run_server(port=8000):
    """Start the development server."""
    # Change to public directory to serve static files from there
    os.chdir('public')

    handler = GrowthLabHandler

    # Allow socket reuse to prevent "Address already in use" errors
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"🚀 GrowthLab Dev Server running at http://localhost:{port}/")
        print(f"📝 Edit mode enabled on localhost")
        print(f"📁 Serving from: public/")
        print(f"   Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped")
            sys.exit(0)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
