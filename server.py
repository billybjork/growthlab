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
import cgi
import io
import os
import re
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path
from datetime import datetime


def extract_image_paths(markdown, session_id):
    """Extract all image paths from markdown for this session."""
    pattern = rf'!\[.*?\]\((media/{session_id}/.*?\.webp)\)'
    return set(re.findall(pattern, markdown))


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
            # Parse multipart form data
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self.send_json_response(400, {'error': 'Invalid content type'})
                return

            # Parse the form data
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': content_type,
                }
            )

            # Get the uploaded file
            if 'image' not in form:
                self.send_json_response(400, {'error': 'No image file provided'})
                return

            file_item = form['image']
            if not file_item.file:
                self.send_json_response(400, {'error': 'Empty file'})
                return

            # Get session ID
            session_id = form.getvalue('sessionId', 'session-01')

            # Validate file extension
            filename = file_item.filename
            ext = Path(filename).suffix.lower()
            allowed_exts = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'}
            if ext not in allowed_exts:
                self.send_json_response(400, {'error': f'Invalid file type: {ext}'})
                return

            # Create temp file for upload
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(file_item.file.read())

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
            # Read JSON body
            content_length = int(self.headers.get('Content-Length', 0))
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
            if '..' in session_file or '/' in session_file:
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
