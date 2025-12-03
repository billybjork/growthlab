/**
 * Edit Mode Utilities
 * Shared helper functions for the block editor
 */
window.EditUtils = {
    /**
     * Setup auto-resizing textarea
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called when content changes with new value
     * @returns {Function} - The autoResize function for manual triggering
     */
    setupAutoResizeTextarea(textarea, onUpdate) {
        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        textarea.addEventListener('input', () => {
            autoResize();
            if (onUpdate) onUpdate(textarea.value);
        });

        // Initial resize after DOM settles
        setTimeout(autoResize, 0);

        return autoResize;
    },

    /**
     * Create image element with standard attributes
     * @param {Object} block - Block data with src, alt, style, align
     * @param {Function} onClick - Click handler receives (element, block)
     * @returns {HTMLImageElement}
     */
    createImageElement(block, onClick) {
        const img = document.createElement('img');
        img.src = block.src;
        img.alt = block.alt || '';
        if (block.style) img.setAttribute('style', block.style);
        if (block.align) this.applyAlignment(img, block.align);
        if (onClick) {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick(img, block);
            });
        }
        return img;
    },

    /**
     * Create video container element with iframe
     * @param {Object} block - Block data with src, style, align
     * @param {Function} onClick - Click handler receives (container, block)
     * @returns {HTMLDivElement}
     */
    createVideoElement(block, onClick) {
        const container = document.createElement('div');
        container.className = 'video-container';
        if (block.style) container.setAttribute('style', block.style);
        if (block.align) this.applyAlignment(container, block.align);

        const iframe = document.createElement('iframe');
        iframe.src = block.src;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');

        container.appendChild(iframe);

        if (onClick) {
            container.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick(container, block);
            });
        }
        return container;
    },

    /**
     * Apply alignment CSS to element
     * @param {HTMLElement} element
     * @param {string} align - 'left', 'center', or 'right'
     */
    applyAlignment(element, align) {
        element.style.display = 'block';
        element.style.marginLeft = '';
        element.style.marginRight = '';

        if (align === 'center') {
            element.style.marginLeft = 'auto';
            element.style.marginRight = 'auto';
        } else if (align === 'right') {
            element.style.marginLeft = 'auto';
        }
    },

    /**
     * Get CSS style string for alignment
     * @param {string} align - 'left', 'center', or 'right'
     * @returns {string} - CSS style string
     */
    getAlignmentStyle(align) {
        switch (align) {
            case 'center': return 'margin-left: auto; margin-right: auto';
            case 'right': return 'margin-left: auto';
            default: return '';
        }
    },

    /**
     * Parse alignment from inline style string
     * @param {string|null} style - CSS style string
     * @returns {string} - 'left', 'center', or 'right'
     */
    parseAlignmentFromStyle(style) {
        if (!style) return 'left';
        const hasMarginLeft = style.includes('margin-left: auto') || style.includes('margin-left:auto');
        const hasMarginRight = style.includes('margin-right: auto') || style.includes('margin-right:auto');

        if (hasMarginLeft && hasMarginRight) return 'center';
        if (hasMarginLeft) return 'right';
        return 'left';
    },

    /**
     * Build media style string (for images/videos with size and alignment)
     * Strips existing alignment margins and rebuilds with new alignment
     * @param {Object} block - Block with style and align properties
     * @returns {string} - Complete CSS style string
     */
    buildMediaStyleString(block) {
        let styleParts = ['display: block'];

        if (block.style) {
            const sizeStyle = block.style
                .replace(/margin-left:\s*auto;?\s*/g, '')
                .replace(/margin-right:\s*auto;?\s*/g, '')
                .replace(/display:\s*block;?\s*/g, '')
                .trim();
            if (sizeStyle) styleParts.push(sizeStyle);
        }

        const alignStyle = this.getAlignmentStyle(block.align);
        if (alignStyle) styleParts.push(alignStyle);

        return styleParts.join('; ');
    },

    /**
     * Insert text at cursor position with native undo support
     * Uses execCommand for undo stack, falls back to setRangeText
     * @param {HTMLTextAreaElement} textarea
     * @param {string} text
     */
    insertTextWithUndo(textarea, text) {
        textarea.focus({ preventScroll: true });
        // execCommand preserves native undo stack
        if (!document.execCommand('insertText', false, text)) {
            // Fallback if execCommand fails
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.setRangeText(text, start, end, 'end');
        }
    },

    /**
     * Wrap selected text in textarea with before/after strings
     * @param {HTMLTextAreaElement} textarea
     * @param {string} before - Prefix to add
     * @param {string} after - Suffix to add
     * @param {Function} onUpdate - Called after wrap completes
     */
    wrapSelection(textarea, before, after, onUpdate) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end) || 'text';
        const replacement = before + selectedText + after;

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);
        this.insertTextWithUndo(textarea, replacement);

        // Select the inner text
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selectedText.length;

        if (onUpdate) onUpdate();
    },

    /**
     * Toggle formatting on selection - wraps if not formatted, unwraps if formatted
     * @param {HTMLTextAreaElement} textarea
     * @param {string} before - Opening marker (e.g., '**', '*', '<u>')
     * @param {string} after - Closing marker (e.g., '**', '*', '</u>')
     * @param {Function} onUpdate - Called after toggle completes
     */
    toggleFormat(textarea, before, after, onUpdate) {
        const { value, selectionStart, selectionEnd } = textarea;

        // Check if we can find this format around/containing the selection
        const formatInfo = this._findFormatAroundSelection(value, selectionStart, selectionEnd, before, after);

        if (formatInfo) {
            // Already formatted - unwrap
            const { formatStart, formatEnd, innerStart, innerEnd } = formatInfo;
            const innerText = value.substring(innerStart, innerEnd);

            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(formatStart, formatEnd);
            this.insertTextWithUndo(textarea, innerText);

            // Position cursor/selection on the unwrapped text
            textarea.selectionStart = formatStart;
            textarea.selectionEnd = formatStart + innerText.length;
        } else {
            // Not formatted - wrap
            this.wrapSelection(textarea, before, after, () => {});
        }

        if (onUpdate) onUpdate();
    },

    /**
     * Find format markers around or containing the selection
     * @private
     * @returns {Object|null} - {formatStart, formatEnd, innerStart, innerEnd} or null if not found
     */
    _findFormatAroundSelection(value, selStart, selEnd, before, after) {
        // Strategy: Look backwards for 'before' marker, forwards for 'after' marker
        // The markers must be properly paired around the selection
        // IMPORTANT: Constrain search to current line only (inline formatting doesn't span lines)

        // Find current line boundaries
        const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
        const lineEnd = value.indexOf('\n', selEnd);
        const effectiveLineEnd = lineEnd === -1 ? value.length : lineEnd;

        // Search backwards from selection start for the opening marker
        const searchBackwardLimit = lineStart;
        let openPos = -1;

        for (let i = selStart; i >= searchBackwardLimit; i--) {
            if (value.substring(i, i + before.length) === before) {
                // Check this isn't escaped or part of a longer sequence
                // For ** bold, make sure it's not *** (bold+italic combo)
                const charBefore = i > 0 ? value[i - 1] : '';
                const isValidOpen = before !== '**' || charBefore !== '*';
                if (isValidOpen) {
                    openPos = i;
                    break;
                }
            }
        }

        if (openPos === -1) return null;

        // Search forwards from selection end for the closing marker
        const searchForwardLimit = effectiveLineEnd;
        let closePos = -1;

        // Start searching from after the opening marker's content begins
        const searchStart = Math.max(openPos + before.length, selEnd);

        for (let i = searchStart; i <= searchForwardLimit - after.length; i++) {
            if (value.substring(i, i + after.length) === after) {
                // For ** bold, make sure it's not ***
                const charAfter = i + after.length < value.length ? value[i + after.length] : '';
                const isValidClose = after !== '**' || charAfter !== '*';
                if (isValidClose) {
                    closePos = i;
                    break;
                }
            }
        }

        if (closePos === -1) return null;

        // Verify the selection is actually inside this formatted region
        const innerStart = openPos + before.length;
        const innerEnd = closePos;

        if (selStart >= innerStart && selEnd <= innerEnd) {
            return {
                formatStart: openPos,
                formatEnd: closePos + after.length,
                innerStart,
                innerEnd
            };
        }

        // Selection extends outside the formatted region
        return null;
    },

    /**
     * Handle formatting keyboard shortcuts (Cmd/Ctrl + B/I/U/K)
     * @param {KeyboardEvent} e
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called after formatting applied
     * @returns {boolean} - True if shortcut was handled
     */
    handleFormattingShortcuts(e, textarea, onUpdate) {
        if (!(e.metaKey || e.ctrlKey)) return false;

        switch (e.key) {
            case 'b':
                e.preventDefault();
                this.toggleFormat(textarea, '**', '**', onUpdate);
                return true;
            case 'i':
                e.preventDefault();
                this.toggleFormat(textarea, '*', '*', onUpdate);
                return true;
            case 'u':
                e.preventDefault();
                this.toggleFormat(textarea, '<u>', '</u>', onUpdate);
                return true;
            case 'k':
                e.preventDefault();
                this.insertLink(textarea, onUpdate);
                return true;
        }
        return false;
    },

    /**
     * Find markdown link at cursor position
     * @param {HTMLTextAreaElement} textarea
     * @returns {Object|null} - {start, end, text, url, textStart, textEnd, urlStart, urlEnd} or null
     */
    findLinkAtCursor(textarea) {
        const { value, selectionStart } = textarea;

        // Search backwards for '[' that starts a link
        let bracketStart = -1;
        for (let i = selectionStart; i >= Math.max(0, selectionStart - 500); i--) {
            if (value[i] === '[') {
                bracketStart = i;
                break;
            }
            // Stop if we hit a newline or another link's closing
            if (value[i] === '\n' || value[i] === ')') break;
        }

        if (bracketStart === -1) return null;

        // Find the full link pattern: [text](url)
        const afterBracket = value.substring(bracketStart);
        const linkMatch = afterBracket.match(/^\[([^\]]*)\]\(([^)]*)\)/);

        if (!linkMatch) return null;

        const fullMatch = linkMatch[0];
        const linkEnd = bracketStart + fullMatch.length;

        // Check if cursor is actually inside this link
        if (selectionStart > linkEnd) return null;

        return {
            start: bracketStart,
            end: linkEnd,
            text: linkMatch[1],
            url: linkMatch[2],
            textStart: bracketStart + 1,
            textEnd: bracketStart + 1 + linkMatch[1].length,
            urlStart: bracketStart + linkMatch[1].length + 3, // [text](
            urlEnd: linkEnd - 1
        };
    },

    /**
     * Insert or edit markdown link at cursor
     * If cursor is inside existing link, edits the URL
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called after link inserted/edited
     */
    async insertLink(textarea, onUpdate) {
        // Check if cursor is inside an existing link
        const existingLink = this.findLinkAtCursor(textarea);

        if (existingLink) {
            // Edit existing link
            const newUrl = await this.showLinkDialog(existingLink.url);
            if (newUrl === null) return; // Cancelled

            if (newUrl === '') {
                // Empty URL = remove link, keep text
                textarea.focus({ preventScroll: true });
                textarea.setSelectionRange(existingLink.start, existingLink.end);
                this.insertTextWithUndo(textarea, existingLink.text);
            } else {
                // Update URL
                const newLink = `[${existingLink.text}](${newUrl})`;
                textarea.focus({ preventScroll: true });
                textarea.setSelectionRange(existingLink.start, existingLink.end);
                this.insertTextWithUndo(textarea, newLink);
            }
        } else {
            // Create new link
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end) || 'link text';

            const url = await this.showLinkDialog();
            if (!url) return;

            const linkText = `[${selectedText}](${url})`;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(start, end);
            this.insertTextWithUndo(textarea, linkText);
        }

        if (onUpdate) onUpdate();
    },

    /**
     * Remove link at cursor, keeping the text
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called after removal
     * @returns {boolean} - True if a link was removed
     */
    removeLink(textarea, onUpdate) {
        const link = this.findLinkAtCursor(textarea);
        if (!link) return false;

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(link.start, link.end);
        this.insertTextWithUndo(textarea, link.text);

        if (onUpdate) onUpdate();
        return true;
    },

    /**
     * Convert video URL to embeddable format
     * Supports YouTube (youtube.com/watch, youtu.be) and Vimeo
     * @param {string} url - Original video URL
     * @returns {string|null} - Embed URL or null if invalid
     */
    convertToEmbedUrl(url) {
        try {
            new URL(url);
        } catch {
            return null;
        }

        // YouTube watch URLs
        if (url.includes('youtube.com/watch')) {
            const parsedUrl = new URL(url);
            const videoId = parsedUrl.searchParams.get('v');
            const startTime = parsedUrl.searchParams.get('t');
            if (!videoId) return null;
            const startParam = startTime ? `?start=${parseInt(startTime, 10)}` : '';
            return `https://www.youtube.com/embed/${videoId}${startParam}`;
        }

        // YouTube short URLs
        if (url.includes('youtu.be/')) {
            const parsedUrl = new URL(url);
            const videoId = parsedUrl.pathname.slice(1); // Remove leading /
            const startTime = parsedUrl.searchParams.get('t');
            if (!videoId) return null;
            const startParam = startTime ? `?start=${parseInt(startTime, 10)}` : '';
            return `https://www.youtube.com/embed/${videoId}${startParam}`;
        }

        // Vimeo URLs
        if (url.includes('vimeo.com/') && !url.includes('/video/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
        }

        // Already an embed URL or unknown format - return as-is
        return url;
    },

    /**
     * Apply text alignment CSS to element
     * @param {HTMLElement} element
     * @param {string} align - 'left', 'center', or 'right'
     */
    applyTextAlignment(element, align) {
        element.style.textAlign = align || 'left';
    },

    /**
     * Get CSS style string for text alignment
     * @param {string} align - 'left', 'center', or 'right'
     * @returns {string} - CSS style string
     */
    getTextAlignmentStyle(align) {
        if (!align || align === 'left') return '';
        return `text-align: ${align}`;
    },

    /**
     * Parse text alignment from inline style string
     * @param {string|null} style - CSS style string
     * @returns {string} - 'left', 'center', or 'right'
     */
    parseTextAlignmentFromStyle(style) {
        if (!style) return 'left';
        const match = style.match(/text-align:\s*(left|center|right)/);
        return match ? match[1] : 'left';
    },

    /**
     * Handle list-related keyboard shortcuts (Enter, Tab, Shift+Tab)
     * @param {KeyboardEvent} e
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called after modification
     * @returns {boolean} - True if shortcut was handled
     */
    handleListShortcuts(e, textarea, onUpdate) {
        // Tab - indent
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            this._indentLines(textarea, onUpdate);
            return true;
        }

        // Shift+Tab - outdent
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            this._outdentLines(textarea, onUpdate);
            return true;
        }

        // Enter - list continuation
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            if (this._handleListEnter(e, textarea, onUpdate)) {
                return true;
            }
        }

        // Backspace/Delete with selection - check if deleting numbered list items
        const { value, selectionStart, selectionEnd } = textarea;
        if ((e.key === 'Backspace' || e.key === 'Delete') && selectionStart !== selectionEnd) {
            const selectedText = value.substring(selectionStart, selectionEnd);
            if (/^\s*\d+\.\s/m.test(selectedText)) {
                setTimeout(() => {
                    this._renumberAllLists(textarea);
                    if (onUpdate) onUpdate();
                }, 0);
            }
        }

        return false;
    },

    /**
     * Renumber all numbered lists in the textarea
     * @private
     */
    _renumberAllLists(textarea) {
        const lines = textarea.value.split('\n');
        const newLines = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const match = line.match(/^(\s*)\d+\.\s/);

            if (match) {
                const indent = match[1];
                let num = 1;
                // Process this list
                while (i < lines.length) {
                    const listLine = lines[i];
                    const listMatch = listLine.match(/^(\s*)\d+\.\s(.*)$/);

                    if (listMatch && listMatch[1] === indent) {
                        // Same indent level - renumber
                        newLines.push(`${indent}${num}. ${listMatch[2]}`);
                        num++;
                        i++;
                    } else if (listLine.match(/^\s*$/) || listLine.startsWith(indent + ' ')) {
                        // Empty line or nested content - keep and continue
                        newLines.push(listLine);
                        i++;
                    } else {
                        // End of this list
                        break;
                    }
                }
            } else {
                newLines.push(line);
                i++;
            }
        }

        const cursorPos = textarea.selectionStart;
        textarea.value = newLines.join('\n');
        textarea.selectionStart = textarea.selectionEnd = Math.min(cursorPos, textarea.value.length);
    },

    /**
     * Indent selected lines or current line by 3 spaces
     * Converts numbered list items to bullets when nested
     * @private
     */
    _indentLines(textarea, onUpdate) {
        const { value, selectionStart, selectionEnd } = textarea;
        const indent = '   '; // 3 spaces for list sub-items

        // Find line boundaries
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let lineEnd = value.indexOf('\n', selectionEnd);
        if (lineEnd === -1) lineEnd = value.length;

        // Get selected text region (full lines)
        const beforeLines = value.substring(0, lineStart);
        const selectedLines = value.substring(lineStart, lineEnd);
        const afterLines = value.substring(lineEnd);

        // Indent each line, converting numbered items to bullets when nested
        const indentedLines = selectedLines.split('\n').map(line => {
            // Check if this is a numbered list item (with any existing indent)
            const numberedMatch = line.match(/^(\s*)\d+\.\s(.*)$/);
            if (numberedMatch) {
                // Convert to bullet when indenting
                return indent + numberedMatch[1] + '- ' + numberedMatch[2];
            }
            return indent + line;
        }).join('\n');

        // Update textarea
        textarea.value = beforeLines + indentedLines + afterLines;

        // Adjust selection
        const addedChars = indentedLines.length - selectedLines.length;
        textarea.selectionStart = selectionStart + indent.length;
        textarea.selectionEnd = selectionEnd + addedChars;

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if (onUpdate) onUpdate();
    },

    /**
     * Outdent selected lines or current line by up to 4 spaces
     * @private
     */
    _outdentLines(textarea, onUpdate) {
        const { value, selectionStart, selectionEnd } = textarea;

        // Find line boundaries
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let lineEnd = value.indexOf('\n', selectionEnd);
        if (lineEnd === -1) lineEnd = value.length;

        // Get selected text region (full lines)
        const beforeLines = value.substring(0, lineStart);
        const selectedLines = value.substring(lineStart, lineEnd);
        const afterLines = value.substring(lineEnd);

        // Track how much we remove from first line (for cursor adjustment)
        let firstLineRemoved = 0;
        let totalRemoved = 0;

        // Outdent each line (remove up to 4 leading spaces)
        const outdentedLines = selectedLines.split('\n').map((line, idx) => {
            const match = line.match(/^( {1,4}|\t)/);
            if (match) {
                const removed = match[0].length;
                if (idx === 0) firstLineRemoved = removed;
                totalRemoved += removed;
                return line.substring(removed);
            }
            return line;
        }).join('\n');

        // Update textarea
        textarea.value = beforeLines + outdentedLines + afterLines;

        // Adjust selection
        textarea.selectionStart = Math.max(lineStart, selectionStart - firstLineRemoved);
        textarea.selectionEnd = selectionEnd - totalRemoved;

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if (onUpdate) onUpdate();
    },

    /**
     * Handle Enter key in list context - continue or end list
     * @private
     * @returns {boolean} - True if handled as list operation
     */
    _handleListEnter(e, textarea, onUpdate) {
        const { value, selectionStart, selectionEnd } = textarea;

        // Only handle if no selection (cursor position)
        if (selectionStart !== selectionEnd) return false;

        // Get current line
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = value.indexOf('\n', selectionStart);
        const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);

        // Check for unordered list: -, *, +
        const unorderedMatch = currentLine.match(/^(\s*)([-*+])\s(.*)$/);
        if (unorderedMatch) {
            const [, indent, marker, content] = unorderedMatch;

            // If empty list item, remove the bullet
            if (content.trim() === '') {
                e.preventDefault();
                // Remove the bullet line content, leave just the indent
                const before = value.substring(0, lineStart);
                const after = value.substring(lineEnd === -1 ? value.length : lineEnd);
                textarea.value = before + after;
                textarea.selectionStart = textarea.selectionEnd = lineStart;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                if (onUpdate) onUpdate();
                return true;
            }

            // Continue list with same marker
            e.preventDefault();
            const newLine = `\n${indent}${marker} `;
            this.insertTextWithUndo(textarea, newLine);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (onUpdate) onUpdate();
            return true;
        }

        // Check for ordered list: 1., 2., etc.
        const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
        if (orderedMatch) {
            const [, indent, num, content] = orderedMatch;

            // If empty list item, remove the bullet and renumber subsequent items
            if (content.trim() === '') {
                e.preventDefault();
                const currentNum = parseInt(num, 10);
                const before = value.substring(0, lineStart);
                const after = value.substring(lineEnd === -1 ? value.length : lineEnd);
                textarea.value = before + after;
                textarea.selectionStart = textarea.selectionEnd = lineStart;

                // Renumber subsequent items starting from the removed number
                this._renumberListFrom(textarea, indent, lineStart, currentNum);

                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                if (onUpdate) onUpdate();
                return true;
            }

            // Continue list with incremented number
            e.preventDefault();
            const nextNum = parseInt(num, 10) + 1;
            const newLine = `\n${indent}${nextNum}. `;
            this.insertTextWithUndo(textarea, newLine);

            // Renumber subsequent items at the same indent level
            const cursorPos = textarea.selectionStart;
            this._renumberListAfter(textarea, indent, nextNum);
            textarea.selectionStart = textarea.selectionEnd = cursorPos;

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            if (onUpdate) onUpdate();
            return true;
        }

        return false;
    },

    /**
     * Renumber ordered list items after a given position
     * @private
     * @param {HTMLTextAreaElement} textarea
     * @param {string} indent - The indentation to match
     * @param {number} startNum - The number of the newly inserted item
     */
    _renumberListAfter(textarea, indent, startNum) {
        const { value, selectionStart } = textarea;

        // Find the end of the current line (where cursor is)
        let lineEnd = value.indexOf('\n', selectionStart);
        if (lineEnd === -1) return; // No lines after

        // Process lines after the cursor
        const before = value.substring(0, lineEnd);
        const after = value.substring(lineEnd);

        // Build regex to match numbered list items at this indent level
        const escapedIndent = indent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const listItemRegex = new RegExp(`^${escapedIndent}(\\d+)\\.\\s`);

        let expectedNum = startNum + 1;
        const lines = after.split('\n');
        const newLines = [lines[0]]; // First element is empty (before first \n)

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(listItemRegex);

            if (match) {
                // This is a list item at the same indent - renumber it
                newLines.push(line.replace(listItemRegex, `${indent}${expectedNum}. `));
                expectedNum++;
            } else if (line.match(/^\s*$/) || line.startsWith(indent + ' ')) {
                // Empty line or more indented (nested content) - keep as-is, continue
                newLines.push(line);
            } else {
                // Different indent or not a list item - stop renumbering, keep rest as-is
                newLines.push(...lines.slice(i));
                break;
            }
        }

        textarea.value = before + newLines.join('\n');
    },

    /**
     * Renumber ordered list items starting from a position
     * Used when removing a list item to fix subsequent numbering
     * @private
     * @param {HTMLTextAreaElement} textarea
     * @param {string} indent - The indentation to match
     * @param {number} fromPos - Position to start looking from
     * @param {number} startNum - The number to start with
     */
    _renumberListFrom(textarea, indent, fromPos, startNum) {
        const { value } = textarea;

        // Process from the given position
        const before = value.substring(0, fromPos);
        const after = value.substring(fromPos);

        // Build regex to match numbered list items at this indent level
        const escapedIndent = indent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const listItemRegex = new RegExp(`^${escapedIndent}(\\d+)\\.\\s`);

        let expectedNum = startNum;
        const lines = after.split('\n');
        const newLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(listItemRegex);

            if (match) {
                // This is a list item at the same indent - renumber it
                newLines.push(line.replace(listItemRegex, `${indent}${expectedNum}. `));
                expectedNum++;
            } else if (line.match(/^\s*$/) || line.startsWith(indent + ' ')) {
                // Empty line or more indented (nested content) - keep as-is, continue
                newLines.push(line);
            } else {
                // Different indent or not a list item - stop renumbering, keep rest as-is
                newLines.push(...lines.slice(i));
                break;
            }
        }

        textarea.value = before + newLines.join('\n');
    },

    // ==================== Link Dialog ====================

    /** Cached dialog element */
    _linkDialog: null,

    /** Cached sessions data: { sessionFile: [{ title, slug }, ...] } */
    _sessionsCache: null,

    /**
     * Generate URL slug from heading text (mirrors viewer.js logic)
     */
    _generateSlug(headingText) {
        return headingText
            .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },

    /**
     * Parse session markdown to extract card titles and slugs
     */
    _parseSessionCards(markdown) {
        const cards = markdown.split(/\n\s*---\s*\n/);
        return cards.map((cardMd, index) => {
            const match = cardMd.match(/^#{2,3}\s+(.+)$/m);
            const title = match ? match[1].trim() : `Card ${index + 1}`;
            const slug = match ? this._generateSlug(match[1]) : null;
            return { title, slug, index };
        });
    },

    /**
     * Fetch and cache all sessions' card data
     */
    async _fetchSessions() {
        if (this._sessionsCache) return this._sessionsCache;

        const sessionFiles = ['session-01', 'session-02', 'session-03'];
        this._sessionsCache = {};

        await Promise.all(sessionFiles.map(async (file) => {
            try {
                const response = await fetch(`sessions/${file}.md`);
                if (response.ok) {
                    const markdown = await response.text();
                    this._sessionsCache[file] = this._parseSessionCards(markdown);
                }
            } catch (e) {
                console.warn(`Could not load ${file}:`, e);
            }
        }));

        return this._sessionsCache;
    },

    /**
     * Create and return the link dialog element
     */
    _createLinkDialog() {
        if (this._linkDialog) return this._linkDialog;

        const backdrop = document.createElement('div');
        backdrop.className = 'link-dialog-backdrop';
        backdrop.innerHTML = `
            <div class="link-dialog">
                <div class="link-dialog-header">Insert Link</div>
                <input type="text" class="link-dialog-url" placeholder="Paste URL...">
                <div class="link-dialog-divider">or link to a card</div>
                <div class="link-dialog-sessions"></div>
                <div class="link-dialog-actions">
                    <button type="button" class="link-dialog-cancel">Cancel</button>
                    <button type="button" class="link-dialog-insert">Insert</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        this._linkDialog = backdrop;
        return backdrop;
    },

    /**
     * Show link dialog and return selected URL
     * @param {string} prefillUrl - Optional URL to pre-fill
     * @returns {Promise<string|null>} - URL or null if cancelled
     */
    async showLinkDialog(prefillUrl = '') {
        const dialog = this._createLinkDialog();
        const urlInput = dialog.querySelector('.link-dialog-url');
        const sessionsContainer = dialog.querySelector('.link-dialog-sessions');
        const insertBtn = dialog.querySelector('.link-dialog-insert');
        const cancelBtn = dialog.querySelector('.link-dialog-cancel');

        // Pre-fill URL
        urlInput.value = prefillUrl;

        // Load sessions
        sessionsContainer.innerHTML = '<div class="link-dialog-loading">Loading cards...</div>';
        dialog.classList.add('visible');

        // Focus after visibility transition starts (browser needs a frame to process visibility change)
        requestAnimationFrame(() => {
            urlInput.focus();
            urlInput.select();
        });

        const sessions = await this._fetchSessions();

        // Build sessions list
        sessionsContainer.innerHTML = '';
        for (const [file, cards] of Object.entries(sessions)) {
            const sessionNum = file.replace('session-', '');
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'link-dialog-session';
            sessionDiv.innerHTML = `<div class="link-dialog-session-title">Session ${sessionNum}</div>`;

            const cardsList = document.createElement('div');
            cardsList.className = 'link-dialog-cards';

            cards.forEach(card => {
                const cardBtn = document.createElement('button');
                cardBtn.type = 'button';
                cardBtn.className = 'link-dialog-card';
                cardBtn.textContent = card.title;
                cardBtn.dataset.url = `session.html?file=${file}&card=${card.slug || card.index}`;
                cardsList.appendChild(cardBtn);
            });

            sessionDiv.appendChild(cardsList);
            sessionsContainer.appendChild(sessionDiv);
        }

        return new Promise((resolve) => {
            const cleanup = () => {
                dialog.classList.remove('visible');
                dialog.removeEventListener('click', handleClick);
                document.removeEventListener('keydown', handleKeydown);
            };

            const handleClick = (e) => {
                // Card button clicked
                if (e.target.classList.contains('link-dialog-card')) {
                    cleanup();
                    resolve(e.target.dataset.url);
                    return;
                }

                // Insert button
                if (e.target === insertBtn) {
                    cleanup();
                    resolve(urlInput.value || null);
                    return;
                }

                // Cancel button or backdrop
                if (e.target === cancelBtn || e.target === dialog) {
                    cleanup();
                    resolve(null);
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                } else if (e.key === 'Enter' && e.target === urlInput) {
                    cleanup();
                    resolve(urlInput.value || null);
                }
            };

            dialog.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleKeydown);
        });
    }
};
