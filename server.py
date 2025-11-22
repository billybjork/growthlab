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
import subprocess
import sys
from pathlib import Path
from datetime import datetime


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

            # Create input directory
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            input_dir = Path('media/_input') / session_id
            input_dir.mkdir(parents=True, exist_ok=True)

            # Save uploaded file
            input_filename = f"{timestamp}{ext}"
            input_path = input_dir / input_filename

            with open(input_path, 'wb') as f:
                f.write(file_item.file.read())

            # Run image conversion script
            output_dir = Path('media') / session_id
            output_dir.mkdir(parents=True, exist_ok=True)

            try:
                # Run the conversion script
                result = subprocess.run(
                    ['bash', 'scripts/image_convert.sh', session_id],
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                if result.returncode != 0:
                    self.send_json_response(500, {
                        'error': 'Image conversion failed',
                        'details': result.stderr
                    })
                    return

                # Calculate output path
                output_filename = f"{timestamp}.webp"
                output_path = f"media/{session_id}/{output_filename}"

                # Verify the output file exists
                if not Path(output_path).exists():
                    self.send_json_response(500, {
                        'error': 'Converted image not found',
                        'details': f'Expected: {output_path}'
                    })
                    return

                # Return success with the image path
                self.send_json_response(200, {
                    'success': True,
                    'path': output_path
                })

            except subprocess.TimeoutExpired:
                self.send_json_response(500, {'error': 'Image conversion timeout'})
            except Exception as e:
                self.send_json_response(500, {'error': f'Conversion error: {str(e)}'})

        except Exception as e:
            self.send_json_response(500, {'error': f'Upload error: {str(e)}'})

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

            # Read the markdown file
            md_path = Path('sessions') / f"{session_file}.md"
            if not md_path.exists():
                self.send_json_response(404, {'error': 'Session file not found'})
                return

            with open(md_path, 'r', encoding='utf-8') as f:
                markdown = f.read()

            # Split into cards
            cards = markdown.split('\n---\n')

            # Validate card index
            if card_index < 0 or card_index >= len(cards):
                self.send_json_response(400, {'error': 'Invalid card index'})
                return

            # Update the specific card
            cards[card_index] = new_content

            # Join back together
            updated_markdown = '\n---\n'.join(cards)

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
    handler = GrowthLabHandler

    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"🚀 GrowthLab Dev Server running at http://localhost:{port}/")
        print(f"📝 Edit mode enabled on localhost")
        print(f"   Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped")
            sys.exit(0)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)
