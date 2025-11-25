"""Multipart form-data parser (replaces deprecated cgi module)."""

import re


def parse_multipart(body, boundary):
    """
    Parse multipart/form-data.

    Args:
        body: Raw bytes of the request body
        boundary: The boundary string from Content-Type header

    Returns:
        Dict of {field_name: {'data': bytes, 'filename': str or None}}
    """
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
