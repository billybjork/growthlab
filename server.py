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
import os
import sys
import tempfile
from pathlib import Path
from datetime import datetime

from utils.multipart import parse_multipart
from utils.images import (
    convert_to_webp, extract_image_paths, cleanup_unused_images, delete_image,
    find_duplicate, register_image_hash
)
from utils.markdown import validate_session_name, read_session, write_session, update_card, join_cards


class GrowthLabHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler with API endpoints for image upload and markdown editing."""

    def do_GET(self):
        """Handle GET requests, with special handling for config.local.js."""
        parsed_path = urllib.parse.urlparse(self.path)

        # Dynamically serve config.local.js from environment variable if file doesn't exist
        if parsed_path.path == '/js/config.local.js':
            config_path = Path('js/config.local.js')

            print(f"📝 Request for config.local.js - file exists: {config_path.exists()}")

            # If file exists locally (development), serve it normally
            if config_path.exists():
                print("   → Serving local file")
                return super().do_GET()

            # Otherwise, generate from environment variable (production)
            webhook_url = os.environ.get('FORMS_WEBHOOK_URL', '')
            print(f"   → Generating from env var (length: {len(webhook_url)})")

            config_content = f"""/**
 * Production Configuration
 * Auto-generated from environment variables
 */
GROWTHLAB_CONFIG.FORMS_WEBHOOK_URL = '{webhook_url}';
"""
            content_bytes = config_content.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(content_bytes)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content_bytes)
            print(f"   → Sent {len(content_bytes)} bytes as application/javascript")
            return

        return super().do_GET()

    def do_POST(self):
        """Handle POST requests for API endpoints."""
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == '/api/upload-image':
            self.handle_upload_image()
        elif parsed_path.path == '/api/update-card':
            self.handle_update_card()
        elif parsed_path.path == '/api/cleanup-images':
            self.handle_cleanup_images()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_upload_image(self):
        """Handle image upload, conversion to WebP, and return the path."""
        temp_path = None
        try:
            # Check request size limit (10MB max)
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 10 * 1024 * 1024:
                return self.send_json_response(413, {'error': 'File too large (max 10MB)'})

            # Parse multipart form data
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                return self.send_json_response(400, {'error': 'Invalid content type'})

            boundary = content_type.split('boundary=')[1].strip()
            body = self.rfile.read(content_length)
            parts = parse_multipart(body, boundary)

            # Get the uploaded file
            if 'image' not in parts:
                return self.send_json_response(400, {'error': 'No image file provided'})

            file_data = parts['image']
            if not file_data['data']:
                return self.send_json_response(400, {'error': 'Empty file'})

            # Get session ID
            session_id = parts.get('sessionId', {}).get('data', b'session-01').decode('utf-8')

            # Validate file extension
            filename = file_data['filename']
            ext = Path(filename).suffix.lower()
            allowed_exts = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'}
            if ext not in allowed_exts:
                return self.send_json_response(400, {'error': f'Invalid file type: {ext}'})

            # Create temp file for upload
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(file_data['data'])

            # Create output directory
            output_dir = Path('media') / session_id
            output_dir.mkdir(parents=True, exist_ok=True)

            # Check for duplicate before converting
            is_duplicate, existing_file, file_hash = find_duplicate(temp_path, output_dir)
            if is_duplicate:
                print(f"♻️  Duplicate detected, reusing: {existing_file}")
                return self.send_json_response(200, {
                    'success': True,
                    'path': f"media/{session_id}/{existing_file}",
                    'duplicate': True
                })

            # Generate output path
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_filename = f"{timestamp}.webp"
            output_path = output_dir / output_filename

            # Convert image
            if not convert_to_webp(temp_path, output_path, is_gif=(ext == '.gif')):
                return self.send_json_response(500, {
                    'error': 'Image conversion failed',
                    'details': 'No suitable converter available'
                })

            # Verify output exists
            if not output_path.exists():
                return self.send_json_response(500, {
                    'error': 'Converted image not found',
                    'details': f'Expected: {output_path}'
                })

            # Register the new image hash
            register_image_hash(output_dir, output_filename, file_hash)

            self.send_json_response(200, {
                'success': True,
                'path': f"media/{session_id}/{output_filename}"
            })

        except Exception as e:
            self.send_json_response(500, {'error': f'Upload error: {str(e)}'})
        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass

    def handle_update_card(self):
        """Handle markdown file update for a specific card."""
        try:
            # Check request size limit (1MB max for markdown)
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 1 * 1024 * 1024:
                return self.send_json_response(413, {'error': 'Markdown too large (max 1MB)'})

            # Read JSON body
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            # Validate input
            session_file = data.get('sessionFile')
            card_index = data.get('cardIndex')
            new_content = data.get('content')

            if not session_file or card_index is None or new_content is None:
                return self.send_json_response(400, {
                    'error': 'Missing required fields: sessionFile, cardIndex, content'
                })

            # Validate session file name
            session_file = validate_session_name(session_file)
            if not session_file:
                return self.send_json_response(400, {'error': 'Invalid session file name'})

            # Update the card
            success, old_content, new_full_content, error = update_card(session_file, card_index, new_content)
            if not success:
                status = 404 if 'not found' in error else 400
                return self.send_json_response(status, {'error': error})

            # Clean up unused images
            deleted_count = cleanup_unused_images(old_content, new_full_content, session_file)
            if deleted_count > 0:
                print(f"✨ Cleaned up {deleted_count} unused image(s)")

            # Clean up images uploaded this session but not in final markdown
            uploaded_images = data.get('uploadedImages', [])
            if uploaded_images:
                new_images = extract_image_paths(new_full_content, session_file)
                for img_path in uploaded_images:
                    if img_path not in new_images:
                        delete_image(img_path)

            # Write the updated content
            write_session(session_file, new_full_content)
            self.send_json_response(200, {'success': True})

        except json.JSONDecodeError:
            self.send_json_response(400, {'error': 'Invalid JSON'})
        except Exception as e:
            self.send_json_response(500, {'error': f'Update error: {str(e)}'})

    def handle_cleanup_images(self):
        """Delete images that were uploaded but never saved (on cancel)."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            deleted = sum(1 for img in data.get('images', []) if delete_image(img))
            self.send_json_response(200, {'success': True, 'deleted': deleted})
        except Exception as e:
            self.send_json_response(500, {'error': str(e)})

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
    os.chdir('public')

    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), GrowthLabHandler) as httpd:
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
