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
        textarea.focus();
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

        textarea.focus();
        textarea.setSelectionRange(start, end);
        this.insertTextWithUndo(textarea, replacement);

        // Select the inner text
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selectedText.length;

        if (onUpdate) onUpdate();
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
                this.wrapSelection(textarea, '**', '**', onUpdate);
                return true;
            case 'i':
                e.preventDefault();
                this.wrapSelection(textarea, '*', '*', onUpdate);
                return true;
            case 'u':
                e.preventDefault();
                this.wrapSelection(textarea, '<u>', '</u>', onUpdate);
                return true;
            case 'k':
                e.preventDefault();
                this.insertLink(textarea, onUpdate);
                return true;
        }
        return false;
    },

    /**
     * Insert markdown link at cursor, prompting for URL
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onUpdate - Called after link inserted
     */
    insertLink(textarea, onUpdate) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end) || 'link text';

        const url = prompt('Enter URL:');
        if (!url) return;

        const linkText = `[${selectedText}](${url})`;
        textarea.focus();
        textarea.setSelectionRange(start, end);
        this.insertTextWithUndo(textarea, linkText);

        if (onUpdate) onUpdate();
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
            const videoId = new URL(url).searchParams.get('v');
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        // YouTube short URLs
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
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
    }
};
