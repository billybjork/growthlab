"""Markdown/card manipulation utilities."""

import os
import re
from pathlib import Path


CARD_DELIMITER = '\n---\n'


def split_cards(markdown):
    """Split markdown content into cards by delimiter."""
    return markdown.split(CARD_DELIMITER)


def join_cards(cards):
    """Join cards back into markdown content."""
    return CARD_DELIMITER.join(cards)


def validate_session_name(session_file):
    """
    Validate and sanitize session file name.

    Args:
        session_file: Raw session file name from request

    Returns:
        Sanitized session name, or None if invalid
    """
    # Strip any path components (security: prevent directory traversal)
    session_file = os.path.basename(session_file)

    # Only allow alphanumeric, underscore, and hyphen
    if re.match(r'^[a-zA-Z0-9_-]+$', session_file):
        return session_file
    return None


def get_session_path(session_file):
    """
    Get the path to a session markdown file.

    Args:
        session_file: Sanitized session name (without .md extension)

    Returns:
        Path object to the session file
    """
    return Path('sessions') / f"{session_file}.md"


def read_session(session_file):
    """
    Read a session markdown file.

    Args:
        session_file: Sanitized session name

    Returns:
        Tuple of (content, cards) or (None, None) if not found
    """
    md_path = get_session_path(session_file)
    if not md_path.exists():
        return None, None

    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return content, split_cards(content)


def write_session(session_file, content):
    """
    Write content to a session markdown file.

    Args:
        session_file: Sanitized session name
        content: Full markdown content to write
    """
    md_path = get_session_path(session_file)
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(content)


def update_card(session_file, card_index, new_content):
    """
    Update a specific card in a session file.

    Args:
        session_file: Sanitized session name
        card_index: Index of card to update
        new_content: New content for the card

    Returns:
        Tuple of (success, old_content, new_full_content, error_message)
    """
    old_content, cards = read_session(session_file)

    if old_content is None:
        return False, None, None, 'Session file not found'

    if card_index < 0 or card_index >= len(cards):
        return False, None, None, 'Invalid card index'

    cards[card_index] = new_content
    new_full_content = join_cards(cards)

    return True, old_content, new_full_content, None


def delete_card(session_file, card_index):
    """
    Delete a specific card from a session file.

    Args:
        session_file: Sanitized session name
        card_index: Index of card to delete

    Returns:
        Tuple of (success, deleted_card_content, new_full_content, error_message)
    """
    old_content, cards = read_session(session_file)

    if old_content is None:
        return False, None, None, 'Session file not found'

    if card_index < 0 or card_index >= len(cards):
        return False, None, None, 'Invalid card index'

    if len(cards) <= 1:
        return False, None, None, 'Cannot delete the only card'

    deleted_card_content = cards[card_index]
    del cards[card_index]
    new_full_content = join_cards(cards)

    return True, deleted_card_content, new_full_content, None
