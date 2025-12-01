/**
 * Edit Blocks Module
 * Block parsing and markdown conversion for the block editor
 * Pure functions - no DOM manipulation
 */
window.EditBlocks = (function() {
    'use strict';

    // ========== CONSTANTS ==========

    const BLOCK_SEPARATOR = '<!-- block -->';
    const ROW_START = '<!-- row -->';
    const ROW_END = '<!-- /row -->';
    const COL_SEPARATOR = '<!-- col -->';

    // ========== BLOCK DETECTION ==========

    /**
     * Detect and set block type based on content
     * @param {object} block - Block object to modify
     * @param {string} trimmed - Trimmed content string
     */
    function detectBlockType(block, trimmed) {
        if (trimmed.startsWith('<details')) {
            block.type = 'details';
            const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/s);
            const bodyMatch = trimmed.match(/<\/summary>([\s\S]*)<\/details>/);
            block.summary = summaryMatch ? summaryMatch[1].trim() : 'Click to expand';
            block.body = bodyMatch ? bodyMatch[1].trim() : '';
            block.isOpen = trimmed.includes('<details open');
        } else if (trimmed.startsWith('<img') || /^!\[.*?\]\(.*?\)$/.test(trimmed)) {
            block.type = 'image';
            if (trimmed.startsWith('<img')) {
                const srcMatch = trimmed.match(/src="([^"]*)"/);
                const altMatch = trimmed.match(/alt="([^"]*)"/);
                const styleMatch = trimmed.match(/style="([^"]*)"/);
                block.src = srcMatch ? srcMatch[1] : '';
                block.alt = altMatch ? altMatch[1] : '';
                block.style = styleMatch ? styleMatch[1] : null;
                block.align = EditUtils.parseAlignmentFromStyle(block.style);
            } else {
                const mdMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
                block.src = mdMatch ? mdMatch[2] : '';
                block.alt = mdMatch ? mdMatch[1] : '';
                block.style = null;
                block.align = 'left';
            }
        } else if (trimmed.startsWith('!video(') || trimmed.startsWith('<div class="video-container"')) {
            block.type = 'video';
            if (trimmed.startsWith('!video(')) {
                const urlMatch = trimmed.match(/!video\((.*?)\)/);
                block.src = urlMatch ? urlMatch[1] : '';
                block.style = null;
                block.align = 'left';
            } else {
                const srcMatch = trimmed.match(/src="([^"]*)"/);
                const styleMatch = trimmed.match(/<div class="video-container"[^>]*style="([^"]*)"/);
                block.src = srcMatch ? srcMatch[1] : '';
                block.style = styleMatch ? styleMatch[1] : null;
                block.align = EditUtils.parseAlignmentFromStyle(block.style);
            }
        } else if (trimmed.startsWith('<div class="callout"')) {
            block.type = 'callout';
            const contentMatch = trimmed.match(/<div class="callout">([\s\S]*?)<\/div>/);
            block.content = contentMatch ? contentMatch[1].trim() : '';
        } else if (trimmed.startsWith('<div style="text-align:') || trimmed.startsWith('<div style="text-align :')) {
            // Text block with alignment wrapper
            block.type = 'text';
            const styleMatch = trimmed.match(/<div style="([^"]*)">([\s\S]*?)<\/div>/);
            if (styleMatch) {
                block.align = EditUtils.parseTextAlignmentFromStyle(styleMatch[1]);
                block.content = styleMatch[2].trim();
            } else {
                block.align = 'left';
            }
        } else if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
            block.type = 'divider';
        } else {
            block.type = 'text';
            block.align = 'left';
        }
    }

    /**
     * Generate unique block ID
     * @param {number} index - Block index
     * @returns {string}
     */
    function generateBlockId(index) {
        return `block-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`;
    }

    /**
     * Parse a single block from raw content
     * @param {string} content - Raw block content
     * @param {number} index - Block index for ID generation
     * @returns {object} - Parsed block object
     */
    function parseSingleBlock(content, index) {
        const trimmed = content.trim();
        const block = {
            id: generateBlockId(index),
            content: content
        };
        detectBlockType(block, trimmed);
        return block;
    }

    // ========== PARSING ==========

    /**
     * Parse markdown content into blocks separated by <!-- block -->
     * Detects block types: text, image, video, details, row, callout
     * @param {string} markdown - Raw markdown content
     * @returns {Array} - Array of parsed block objects
     */
    function parseIntoBlocks(markdown) {
        // Split on block separator with flexible whitespace (1+ newlines on each side)
        const rawBlocks = markdown.split(new RegExp(`\\n+${BLOCK_SEPARATOR}\\n+`));

        return rawBlocks.map((content, index) => {
            const trimmed = content.trim();

            // Check for row block
            if (trimmed.startsWith(ROW_START) && trimmed.endsWith(ROW_END)) {
                // Extract content between row markers
                const innerContent = trimmed
                    .slice(ROW_START.length, -ROW_END.length)
                    .trim();

                // Split on column separator
                const columns = innerContent.split(new RegExp(`\\n*${COL_SEPARATOR}\\n*`));

                if (columns.length >= 2) {
                    return {
                        id: `block-${Date.now()}-${index}`,
                        type: 'row',
                        left: parseSingleBlock(columns[0], index * 10),
                        right: parseSingleBlock(columns[1], index * 10 + 1)
                    };
                }
            }

            // Regular block parsing
            return parseSingleBlock(content, index);
        });
    }

    // ========== FORMATTING ==========

    /**
     * Format image block as markdown/HTML
     * Uses HTML img tag if sized or aligned, markdown syntax otherwise
     * @param {object} block
     * @returns {string}
     */
    function formatImageMarkdown(block) {
        const hasSize = block.style && (block.style.includes('width') || block.style.includes('max-width'));
        const hasAlignment = block.align && block.align !== 'left';

        if (hasSize || hasAlignment) {
            const finalStyle = EditUtils.buildMediaStyleString(block);
            return `<img src="${block.src}" alt="${block.alt || ''}" style="${finalStyle}">`;
        }
        // Use markdown syntax for unsized, left-aligned images
        return `![${block.alt || ''}](${block.src})`;
    }

    /**
     * Format video block as HTML or custom syntax
     * Uses HTML div for sized/aligned, custom !video() syntax otherwise
     * @param {object} block
     * @returns {string}
     */
    function formatVideoMarkdown(block) {
        const hasSize = block.style && (block.style.includes('width') || block.style.includes('max-width'));
        const hasAlignment = block.align && block.align !== 'left';

        if (hasSize || hasAlignment) {
            const finalStyle = EditUtils.buildMediaStyleString(block);
            return `<div class="video-container" style="${finalStyle}"><iframe src="${block.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        // Use custom syntax for unsized, left-aligned videos
        return `!video(${block.src})`;
    }

    /**
     * Format details/collapsible block as HTML
     * @param {object} block
     * @returns {string}
     */
    function formatDetailsHtml(block) {
        const openAttr = block.isOpen ? ' open' : '';
        return `<details${openAttr}>\n<summary>${block.summary}</summary>\n\n${block.body}\n\n</details>`;
    }

    /**
     * Format callout block as HTML
     * @param {object} block
     * @returns {string}
     */
    function formatCalloutHtml(block) {
        return `<div class="callout">${block.content}</div>`;
    }

    /**
     * Format row block as markdown with row/col markers
     * @param {object} block
     * @returns {string}
     */
    function formatRowMarkdown(block) {
        const leftContent = blockToMarkdown(block.left);
        const rightContent = blockToMarkdown(block.right);
        return `${ROW_START}\n${leftContent}\n${COL_SEPARATOR}\n${rightContent}\n${ROW_END}`;
    }

    /**
     * Convert a single block to markdown string
     * @param {object} block
     * @returns {string}
     */
    function blockToMarkdown(block) {
        switch (block.type) {
            case 'text':
                const content = block.content.trim();
                // Wrap in div if alignment is not left
                if (block.align && block.align !== 'left') {
                    const alignStyle = EditUtils.getTextAlignmentStyle(block.align);
                    return `<div style="${alignStyle}">${content}</div>`;
                }
                return content;
            case 'image':
                return formatImageMarkdown(block);
            case 'video':
                return formatVideoMarkdown(block);
            case 'details':
                return formatDetailsHtml(block);
            case 'row':
                return formatRowMarkdown(block);
            case 'callout':
                return formatCalloutHtml(block);
            case 'divider':
                return '***';
            default:
                return block.content.trim();
        }
    }

    /**
     * Convert blocks array back to markdown string
     * Uses double newlines around separator for proper markdown parsing
     * @param {Array} blocks
     * @returns {string}
     */
    function blocksToMarkdown(blocks) {
        return blocks.map(block => blockToMarkdown(block)).join(`\n\n${BLOCK_SEPARATOR}\n\n`);
    }

    /**
     * Create a new empty block of specified type
     * @param {string} type - Block type
     * @param {object} props - Additional properties
     * @returns {object}
     */
    function createBlock(type, props = {}) {
        const base = {
            id: `block-${Date.now()}`,
            type: type
        };

        switch (type) {
            case 'text':
                return { ...base, content: '', align: 'left', ...props };
            case 'image':
                return { ...base, src: '', alt: '', style: null, align: 'left', ...props };
            case 'video':
                return { ...base, src: '', style: null, align: 'left', ...props };
            case 'details':
                return { ...base, summary: 'Click to expand', body: '', isOpen: false, ...props };
            case 'callout':
                return { ...base, content: '', ...props };
            case 'row':
                return {
                    ...base,
                    left: createBlock('text'),
                    right: createBlock('text'),
                    ...props
                };
            case 'divider':
                return { ...base, ...props };
            default:
                return { ...base, content: '', align: 'left', ...props };
        }
    }

    // ========== PUBLIC API ==========

    return {
        // Constants
        BLOCK_SEPARATOR,
        ROW_START,
        ROW_END,
        COL_SEPARATOR,

        // Parsing
        parseIntoBlocks,
        parseSingleBlock,

        // Formatting
        blockToMarkdown,
        blocksToMarkdown,
        formatImageMarkdown,
        formatVideoMarkdown,
        formatDetailsHtml,
        formatCalloutHtml,
        formatRowMarkdown,

        // Factory
        createBlock,
        generateBlockId
    };
})();
