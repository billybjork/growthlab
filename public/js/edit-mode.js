/**
 * Edit Mode - Main Coordinator
 * Block-based editor: text blocks show raw markdown, media blocks render for resizing
 *
 * Module structure (all in js/edit-*.js):
 *   EditUtils  - Shared helpers (textarea, formatting, alignment)
 *   EditBlocks - Block parsing & markdown conversion
 *   EditSlash  - Slash command menu system
 *   EditMedia  - Media resize, alignment, upload
 *   EditMode   - This file: rendering, drag-drop, save/cancel (uses all above)
 *
 * Public API: window.initEditMode(STATE, { parseMarkdown, updateCardMedia, isDevMode })
 *   Returns: { addEditButtonToCard, enterEditMode, setupEditModeKeyboardShortcuts }
 */

function initEditMode(STATE, { parseMarkdown, updateCardMedia, isDevMode }) {
    if (!isDevMode) return;

    // ========== CONSTANTS ==========

    const NOTIFICATION_CONFIG = {
        FADE_IN_DELAY_MS: 10,
        DISPLAY_DURATION_MS: 3000,
        FADE_OUT_DURATION_MS: 300
    };

    // ========== STATE ==========

    let globalToolbar = null;
    let currentBlocks = [];

    // Drag state
    let draggedBlockIndex = null;
    let dropIndicator = null;

    // Event listener tracking for cleanup
    let toolbarAbortController = null;
    let globalKeyboardAbortController = null;
    let cardClickHandler = null;

    // CSS lazy-loading state
    let editModeCssLoaded = false;

    // ========== CSS LAZY LOADING ==========

    function loadEditModeCSS() {
        if (editModeCssLoaded) return Promise.resolve();
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/edit-mode.css';
            link.onload = () => {
                editModeCssLoaded = true;
                resolve();
            };
            link.onerror = () => {
                console.error('Failed to load edit-mode.css');
                resolve(); // Continue anyway, will just be unstyled
            };
            document.head.appendChild(link);
        });
    }

    // ========== NOTIFICATION SYSTEM ==========

    // Track active notifications for stacking
    let activeNotifications = [];

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string|boolean} type - 'success', 'error', 'info', 'warning' or boolean (true=error, false=success)
     */
    function showNotification(message, type = 'success') {
        // Support legacy boolean API (isError)
        if (type === true) type = 'error';
        if (type === false) type = 'success';

        const notification = document.createElement('div');
        notification.className = `edit-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Calculate stack position and set top offset directly
        const stackIndex = activeNotifications.length;
        const baseTop = window.innerWidth <= 768 ? 15 : 30;
        const stackOffset = window.innerWidth <= 768 ? 55 : 60;
        notification.style.top = `${baseTop + stackIndex * stackOffset}px`;
        activeNotifications.push(notification);

        setTimeout(() => notification.classList.add('show'), NOTIFICATION_CONFIG.FADE_IN_DELAY_MS);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                // Remove from active list and update remaining positions
                const idx = activeNotifications.indexOf(notification);
                if (idx > -1) {
                    activeNotifications.splice(idx, 1);
                    // Update positions for remaining notifications
                    activeNotifications.forEach((n, i) => {
                        n.style.top = `${baseTop + i * stackOffset}px`;
                    });
                }
                notification.remove();
            }, NOTIFICATION_CONFIG.FADE_OUT_DURATION_MS);
        }, NOTIFICATION_CONFIG.DISPLAY_DURATION_MS);
    }

    // ========== SLASH COMMAND INTEGRATION ==========

    function initSlashCommands() {
        EditSlash.init((action, data) => {
            if (action === 'execute') {
                executeSlashCommand(data.commandId, data.insertIndex);
            }
        });
    }

    function executeSlashCommand(commandId, insertIndex) {
        switch (commandId) {
            case 'text':
                insertBlockAfter(insertIndex, EditBlocks.createBlock('text'));
                break;
            case 'image':
                EditMedia.showImagePicker(insertIndex, (idx, block) => {
                    insertBlockAfter(idx, block);
                }, showNotification);
                break;
            case 'video':
                EditMedia.addVideo(insertIndex, (idx, block) => {
                    insertBlockAfter(idx, block);
                }, showNotification);
                break;
            case 'details':
                insertBlockAfter(insertIndex, EditBlocks.createBlock('details'));
                break;
            case 'callout':
                insertBlockAfter(insertIndex, EditBlocks.createBlock('callout'));
                break;
            case 'divider':
                insertBlockAfter(insertIndex, EditBlocks.createBlock('divider'));
                break;
        }
    }

    // ========== BLOCK RENDERERS ==========

    function renderBlockEditor(blocks, _card) {
        const container = document.createElement('div');
        container.className = 'block-editor';

        blocks.forEach((block, index) => {
            const wrapper = createBlockWrapper(block, index);
            container.appendChild(wrapper);

            // Add merge divider between blocks (not after last block)
            if (index < blocks.length - 1) {
                const nextBlock = blocks[index + 1];
                const canMerge = block.type !== 'row' && nextBlock.type !== 'row';
                const divider = createMergeDivider(index, canMerge);
                container.appendChild(divider);
            }
        });

        // Add "Add Block" button at the end
        const addBlockBtn = document.createElement('button');
        addBlockBtn.className = 'add-block-btn';
        addBlockBtn.innerHTML = '+ Add Block';
        addBlockBtn.addEventListener('click', () => showAddBlockMenu(blocks.length));
        container.appendChild(addBlockBtn);

        return container;
    }

    function createMergeDivider(afterIndex, canMerge) {
        const divider = document.createElement('div');
        divider.className = 'block-merge-divider';

        // Add Block button - always shown
        const addBtn = document.createElement('button');
        addBtn.className = 'divider-add-btn';
        addBtn.innerHTML = '+';
        addBtn.title = 'Add block here';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            EditSlash.showFromButton(addBtn.getBoundingClientRect(), afterIndex);
        });
        divider.appendChild(addBtn);

        // Merge button - only when both blocks are not rows
        if (canMerge) {
            const mergeBtn = document.createElement('button');
            mergeBtn.className = 'merge-btn';
            mergeBtn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" style="vertical-align: middle;"><rect x="1" y="2" width="6" height="12" rx="1" fill="currentColor"/><rect x="9" y="2" width="6" height="12" rx="1" fill="currentColor"/></svg>';
            mergeBtn.title = 'Merge these two blocks into side-by-side columns';
            mergeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mergeBlocksIntoRow(afterIndex);
            });
            divider.appendChild(mergeBtn);
        }

        return divider;
    }

    function mergeBlocksIntoRow(afterIndex) {
        // Save state for undo
        EditUndo.saveState(currentBlocks, 'merge blocks');

        const leftBlock = currentBlocks[afterIndex];
        const rightBlock = currentBlocks[afterIndex + 1];

        const rowBlock = {
            id: `block-${Date.now()}-row`,
            type: 'row',
            left: leftBlock,
            right: rightBlock
        };

        currentBlocks.splice(afterIndex, 2, rowBlock);
        reRenderBlocks();
        showNotification('Blocks merged into columns');
    }

    function createBlockWrapper(block, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'block-wrapper';
        wrapper.dataset.blockIndex = index;
        wrapper.dataset.blockId = block.id;

        // Drag handle
        const handle = document.createElement('div');
        handle.className = 'block-drag-handle';
        handle.innerHTML = '⋮⋮';
        handle.draggable = true;
        handle.addEventListener('dragstart', (e) => handleDragStart(e, index));
        handle.addEventListener('dragend', handleDragEnd);

        // Block content
        const content = document.createElement('div');
        content.className = 'block-content';
        content.appendChild(renderBlockContent(block, index));

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'block-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete block';
        deleteBtn.addEventListener('click', () => deleteBlock(index));

        wrapper.appendChild(handle);
        wrapper.appendChild(content);
        wrapper.appendChild(deleteBtn);

        // Drop zone handling
        wrapper.addEventListener('dragover', (e) => handleDragOver(e, index));
        wrapper.addEventListener('drop', (e) => handleDrop(e, index));

        return wrapper;
    }

    function renderBlockContent(block, index) {
        switch (block.type) {
            case 'text':
                return renderTextBlock(block, index);
            case 'image':
                return renderImageBlock(block, index);
            case 'video':
                return renderVideoBlock(block, index);
            case 'details':
                return renderDetailsBlock(block, index);
            case 'row':
                return renderRowBlock(block, index);
            case 'callout':
                return renderCalloutBlock(block, index);
            case 'divider':
                return renderDividerBlock(block, index);
            default:
                return renderTextBlock(block, index);
        }
    }

    function renderTextBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'text-block';
        container.appendChild(createLineEditor(block, index));
        return container;
    }

    // ========== LINE-LEVEL EDITOR ==========

    /**
     * Create a line-based editor for a text block with inline markdown preview.
     * Each line renders markdown inline and switches to a raw textarea overlay when clicked.
     */
    function createLineEditor(block, index) {
        const container = document.createElement('div');
        container.className = 'text-block-lines';

        if (block.align) {
            container.style.textAlign = block.align;
        }

        let lines = (block.content || '').split('\n');
        if (!lines.length) lines = [''];

        let activeLineIndex = null;

        const updateBlockContent = () => {
            EditUndo.saveTextChange(currentBlocks);
            block.content = lines.join('\n');
        };

        const renderLines = (focusLineIndex = null, focusCaret = null) => {
            container.innerHTML = '';
            lines.forEach((lineText, lineIndex) => {
                const row = buildLineRow(lineText, lineIndex);
                container.appendChild(row);
            });

            requestAnimationFrame(() => {
                container.querySelectorAll('.text-block-line').forEach((row) => {
                    syncLineHeight(row);
                });
            });

            if (focusLineIndex != null) {
                const row = container.querySelector(`.text-block-line[data-line-index="${focusLineIndex}"]`);
                if (row) {
                    activateLine(row, focusCaret);
                }
            }
        };

        const attachLinkPreviewHandlers = (preview, row) => {
            preview.querySelectorAll('a[data-link-url-start]').forEach((linkEl) => {
                linkEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const start = parseInt(linkEl.dataset.linkUrlStart, 10);
                    const end = parseInt(linkEl.dataset.linkUrlEnd, 10);
                    if (!Number.isNaN(start) && !Number.isNaN(end)) {
                        activateLine(row, { start, end });
                    } else {
                        activateLine(row);
                    }
                });
            });
        };

        const buildLineRow = (lineText, lineIndex) => {
            const row = document.createElement('div');
            row.className = 'text-block-line';
            row.dataset.lineIndex = lineIndex;

            const preview = document.createElement('div');
            preview.className = 'text-block-line-preview';

            const isSingleEmptyLine = lines.length === 1 && !lines[0].trim();
            if (isSingleEmptyLine) {
                preview.classList.add('text-block-line-placeholder');
                preview.textContent = 'Type something... (type / for commands)';
            } else {
                preview.appendChild(renderLinePreview(lineText));
            }

            attachLinkPreviewHandlers(preview, row);

            const textarea = document.createElement('textarea');
            textarea.className = 'text-line-input';
            textarea.value = lineText;
            textarea.rows = 1;
            textarea.placeholder = 'Type something... (type / for commands)';

            preview.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                activateLine(row);
            });

            row.addEventListener('click', (e) => {
                if (!row.classList.contains('is-editing')) {
                    e.preventDefault();
                    e.stopPropagation();
                    activateLine(row);
                }
            });

            textarea.addEventListener('input', () => {
                const newValue = textarea.value;

                EditSlash.handleTextareaInput(textarea, index);

                if (newValue.includes('\n')) {
                    const splitLines = newValue.split('\n');
                    lines.splice(lineIndex, 1, ...splitLines);
                    updateBlockContent();
                    renderLines(lineIndex + splitLines.length - 1, splitLines[splitLines.length - 1].length);
                    return;
                }

                lines[lineIndex] = newValue;
                updateBlockContent();
                syncLineHeight(row);
            });

            textarea.addEventListener('keydown', (e) => {
                // Slash command navigation
                if (EditSlash.isActive()) {
                    if (EditSlash.handleKeydown(e)) return;
                }

                // Formatting shortcuts (Cmd+B/I/U/K)
                if (EditUtils.handleFormattingShortcuts(e, textarea, () => {
                    lines[lineIndex] = textarea.value;
                    updateBlockContent();
                    syncLineHeight(row);
                })) return;

                // List indentation shortcuts (Tab, Shift+Tab)
                if (EditUtils.handleListShortcuts(e, textarea, () => {
                    lines[lineIndex] = textarea.value;
                    updateBlockContent();
                })) return;

                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    handleLineSplit(textarea, lineIndex);
                    return;
                }

                if (e.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
                    if (lineIndex > 0) {
                        e.preventDefault();
                        mergeWithPreviousLine(lineIndex);
                    }
                    return;
                }

                if (e.key === 'Delete' && textarea.selectionStart === textarea.value.length && textarea.selectionEnd === textarea.value.length) {
                    if (lineIndex < lines.length - 1) {
                        e.preventDefault();
                        mergeWithNextLine(lineIndex);
                    }
                    return;
                }

                if (e.key === 'ArrowUp' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
                    if (lineIndex > 0) {
                        e.preventDefault();
                        renderLines(lineIndex - 1, lines[lineIndex - 1].length);
                    }
                    return;
                }

                if (e.key === 'ArrowDown' && textarea.selectionStart === textarea.value.length && textarea.selectionEnd === textarea.value.length) {
                    if (lineIndex < lines.length - 1) {
                        e.preventDefault();
                        renderLines(lineIndex + 1, 0);
                    }
                }
            });

            textarea.addEventListener('focus', () => {
                EditMedia.showTextAlignmentToolbar(textarea, block, () => {
                    // Alignment already applied
                });
            });

            textarea.addEventListener('blur', () => {
                if (activeLineIndex !== lineIndex) return;
                setTimeout(() => {
                    // Don't deactivate if focus moved to the link dialog or alignment toolbar
                    if (document.activeElement?.closest('.link-dialog-backdrop')) return;
                    if (document.activeElement?.closest('.alignment-toolbar')) return;
                    deactivateLine(row);
                    EditMedia.hideTextAlignmentToolbar();
                }, 0);
            });

            row.appendChild(preview);
            row.appendChild(textarea);
            return row;
        };

        const activateLine = (row, selection = null) => {
            const lineIndex = Number(row.dataset.lineIndex);

            if (activeLineIndex !== null && activeLineIndex !== lineIndex) {
                const previousRow = container.querySelector(`.text-block-line[data-line-index="${activeLineIndex}"]`);
                if (previousRow) deactivateLine(previousRow);
            }

            activeLineIndex = lineIndex;
            row.classList.add('is-editing');

            const textarea = row.querySelector('.text-line-input');
            textarea.focus();
            if (selection && typeof selection === 'object') {
                textarea.selectionStart = selection.start;
                textarea.selectionEnd = selection.end ?? selection.start;
            } else if (typeof selection === 'number') {
                textarea.selectionStart = selection;
                textarea.selectionEnd = selection;
            } else {
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            }

            syncLineHeight(row);
        };

        const deactivateLine = (row) => {
            const lineIndex = Number(row.dataset.lineIndex);
            const textarea = row.querySelector('.text-line-input');
            const preview = row.querySelector('.text-block-line-preview');

            row.classList.remove('is-editing');

            const currentText = textarea.value;
            preview.classList.remove('text-block-line-placeholder');
            preview.innerHTML = '';

            const isSingleEmptyLine = lines.length === 1 && !lines[0].trim();
            if (isSingleEmptyLine && !currentText.trim()) {
                preview.classList.add('text-block-line-placeholder');
                preview.textContent = 'Type something... (type / for commands)';
            } else {
                preview.appendChild(renderLinePreview(currentText));
                attachLinkPreviewHandlers(preview, row);
            }

            activeLineIndex = null;
            syncLineHeight(row);
        };

        const handleLineSplit = (textarea, lineIndex) => {
            const value = textarea.value;
            const cursor = textarea.selectionStart;
            const before = value.slice(0, cursor);
            const after = value.slice(cursor);

            const listContinuation = getListContinuation(before);

            lines[lineIndex] = before;
            const nextLine = listContinuation ? listContinuation + after.replace(/^\s+/, '') : after;
            lines.splice(lineIndex + 1, 0, nextLine);
            updateBlockContent();

            const caret = listContinuation ? listContinuation.length : 0;
            renderLines(lineIndex + 1, caret);
        };

        const mergeWithPreviousLine = (lineIndex) => {
            if (lineIndex <= 0) return;
            const previous = lines[lineIndex - 1];
            const current = lines[lineIndex];
            const merged = previous + current;
            lines.splice(lineIndex - 1, 2, merged);
            updateBlockContent();
            renderLines(lineIndex - 1, previous.length);
        };

        const mergeWithNextLine = (lineIndex) => {
            if (lineIndex >= lines.length - 1) return;
            const current = lines[lineIndex];
            const next = lines[lineIndex + 1];
            const merged = current + next;
            lines.splice(lineIndex, 2, merged);
            updateBlockContent();
            renderLines(lineIndex, current.length);
        };

        const syncLineHeight = (row) => {
            const preview = row.querySelector('.text-block-line-preview');
            const textarea = row.querySelector('.text-line-input');

            requestAnimationFrame(() => {
                const previewHeight = preview ? preview.offsetHeight : 0;
                const inputHeight = textarea ? textarea.scrollHeight : 0;
                const minHeight = Math.max(27, previewHeight);
                row.style.minHeight = `${minHeight}px`;
                if (row.classList.contains('is-editing')) {
                    row.style.height = `${Math.max(minHeight, inputHeight)}px`;
                } else {
                    row.style.height = '';
                }
            });
        };

        const getListContinuation = (lineText) => {
            const unorderedMatch = lineText.match(/^(\s*)([-*+])\s+/);
            if (unorderedMatch) {
                return `${unorderedMatch[1]}${unorderedMatch[2]} `;
            }
            const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s+/);
            if (orderedMatch) {
                const nextNum = parseInt(orderedMatch[2], 10) + 1;
                return `${orderedMatch[1]}${nextNum}. `;
            }
            return null;
        };

        renderLines();
        return container;
    }

    // ========== INLINE MARKDOWN PREVIEW ==========

    /**
     * Render a single line of markdown into preview HTML
     */
    function renderLinePreview(lineText) {
        const trimmed = lineText.trim();

        if (!trimmed) {
            const empty = document.createElement('span');
            empty.innerHTML = '&nbsp;';
            return empty;
        }

        // Horizontal rule
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
            const hr = document.createElement('hr');
            hr.className = 'text-line-divider';
            return hr;
        }

        // Headings
        const headingMatch = lineText.match(/^(\s*)(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[2].length;
            const contentStart = lineText.indexOf(headingMatch[3]);
            const heading = document.createElement(`h${level}`);
            heading.appendChild(renderInlineMarkdown(headingMatch[3], contentStart));
            return heading;
        }

        // Blockquotes
        const quoteMatch = lineText.match(/^(\s*)>\s+(.*)$/);
        if (quoteMatch) {
            const contentStart = lineText.indexOf(quoteMatch[2]);
            const quote = document.createElement('blockquote');
            quote.appendChild(renderInlineMarkdown(quoteMatch[2], contentStart));
            return quote;
        }

        // Unordered lists
        const listMatch = lineText.match(/^(\s*)([-*+])\s+(.*)$/);
        if (listMatch) {
            return renderListLine({
                indent: listMatch[1],
                marker: listMatch[2],
                content: listMatch[3],
                ordered: false,
                baseOffset: lineText.indexOf(listMatch[3])
            });
        }

        // Ordered lists
        const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (orderedMatch) {
            return renderListLine({
                indent: orderedMatch[1],
                marker: orderedMatch[2],
                content: orderedMatch[3],
                ordered: true,
                baseOffset: lineText.indexOf(orderedMatch[3])
            });
        }

        // Plain text with inline formatting
        const span = document.createElement('span');
        span.appendChild(renderInlineMarkdown(lineText, 0));
        return span;
    }

    /**
     * Render a list-like preview line (bullet, ordered, task)
     */
    function renderListLine(params) {
        const listLine = document.createElement('div');
        listLine.className = 'text-line-list' + (params.ordered ? ' text-line-list-ordered' : ' text-line-list-unordered');

        const indentLevel = getIndentLevel(params.indent);
        if (indentLevel > 0) {
            listLine.style.marginLeft = `${indentLevel * 18}px`;
        }

        let contentText = params.content || '';
        let contentOffset = params.baseOffset || 0;
        let isTask = false;
        let isChecked = false;

        const taskMatch = contentText.match(/^\[( |x|X)\]\s*(.*)$/);
        if (taskMatch) {
            isTask = true;
            isChecked = taskMatch[1].toLowerCase() === 'x';
            const prefixLength = taskMatch[0].length - taskMatch[2].length;
            contentOffset += prefixLength;
            contentText = taskMatch[2];
        }

        const marker = document.createElement('span');
        marker.className = 'text-line-list-marker';
        marker.textContent = params.ordered ? `${params.marker}.` : (isTask ? '' : '•');

        if (isTask) {
            const taskBox = document.createElement('span');
            taskBox.className = 'text-line-task-box' + (isChecked ? ' checked' : '');
            taskBox.setAttribute('aria-hidden', 'true');
            marker.appendChild(taskBox);
        }

        const content = document.createElement('div');
        content.className = 'text-line-list-content' + (isChecked ? ' checked' : '');
        const leadingSpaces = (contentText.match(/^\s*/) || [''])[0].length;
        if (leadingSpaces) {
            contentOffset += leadingSpaces;
            contentText = contentText.slice(leadingSpaces);
        }
        const trimmedContent = contentText.trimEnd();
        if (trimmedContent.trim()) {
            content.appendChild(renderInlineMarkdown(trimmedContent, contentOffset));
        } else {
            const empty = document.createElement('span');
            empty.innerHTML = '&nbsp;';
            content.appendChild(empty);
        }

        listLine.appendChild(marker);
        listLine.appendChild(content);
        return listLine;
    }

    /**
     * Convert indentation whitespace into a list indent level
     */
    function getIndentLevel(indent) {
        if (!indent) return 0;
        const normalized = indent.replace(/\t/g, '   ');
        return Math.floor(normalized.length / 3);
    }

    /**
     * Render inline markdown into a fragment (links + basic formatting)
     */
    function renderInlineMarkdown(text, baseOffset = 0) {
        const fragment = document.createDocumentFragment();
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;

        while ((match = linkRegex.exec(text)) !== null) {
            const [fullMatch, label, url] = match;
            const offset = match.index;

            if (offset > lastIndex) {
                appendInlineFormatted(fragment, text.slice(lastIndex, offset));
            }

            const safeUrl = sanitizeUrl(url);
            if (safeUrl) {
                const link = document.createElement('a');
                link.href = safeUrl;
                link.rel = 'noopener';
                link.target = '_blank';
                const linkStart = offset + baseOffset;
                const urlStart = linkStart + 1 + label.length + 2;
                link.dataset.linkUrlStart = String(urlStart);
                link.dataset.linkUrlEnd = String(urlStart + url.length);
                appendInlineFormatted(link, label);
                fragment.appendChild(link);
            } else {
                fragment.appendChild(document.createTextNode(fullMatch));
            }

            lastIndex = offset + fullMatch.length;
        }

        if (lastIndex < text.length) {
            appendInlineFormatted(fragment, text.slice(lastIndex));
        }

        return fragment;
    }

    function appendInlineFormatted(container, text) {
        container.appendChild(parseInlineTokens(text));
    }

    /**
     * Parse inline markdown tokens (bold, italic, underline, code, strikethrough)
     */
    function parseInlineTokens(text) {
        const fragment = document.createDocumentFragment();
        let idx = 0;

        while (idx < text.length) {
            const token = findNextInlineToken(text, idx);
            if (!token) {
                fragment.appendChild(document.createTextNode(text.slice(idx)));
                break;
            }

            if (token.index > idx) {
                fragment.appendChild(document.createTextNode(text.slice(idx, token.index)));
            }

            idx = token.index;

            if (token.type === 'code') {
                const closeIndex = findTokenIndex(text, token.delimiter, idx + token.length);
                if (closeIndex === -1) {
                    fragment.appendChild(document.createTextNode(token.delimiter));
                    idx += token.length;
                    continue;
                }
                const codeText = text.slice(idx + token.length, closeIndex);
                if (!codeText) {
                    fragment.appendChild(document.createTextNode(token.delimiter));
                    idx += token.length;
                    continue;
                }
                const code = document.createElement('code');
                code.textContent = codeText;
                fragment.appendChild(code);
                idx = closeIndex + token.length;
                continue;
            }

            if (token.type === 'underline') {
                const closeIndex = text.indexOf('</u>', idx + token.length);
                if (closeIndex === -1) {
                    fragment.appendChild(document.createTextNode(token.delimiter));
                    idx += token.length;
                    continue;
                }
                const inner = text.slice(idx + token.length, closeIndex);
                if (!inner.trim()) {
                    fragment.appendChild(document.createTextNode(token.delimiter));
                    idx += token.length;
                    continue;
                }
                const underline = document.createElement('u');
                underline.appendChild(parseInlineTokens(inner));
                fragment.appendChild(underline);
                idx = closeIndex + 4;
                continue;
            }

            const closeIndex = findTokenIndex(text, token.delimiter, idx + token.length);
            if (closeIndex === -1) {
                fragment.appendChild(document.createTextNode(token.delimiter));
                idx += token.length;
                continue;
            }

            const inner = text.slice(idx + token.length, closeIndex);
            if (!inner.trim()) {
                fragment.appendChild(document.createTextNode(token.delimiter));
                idx += token.length;
                continue;
            }

            let element = null;
            if (token.type === 'bold') {
                element = document.createElement('strong');
            } else if (token.type === 'italic') {
                element = document.createElement('em');
            } else if (token.type === 'strikethrough') {
                element = document.createElement('s');
            }

            if (!element) {
                fragment.appendChild(document.createTextNode(token.delimiter));
                idx += token.length;
                continue;
            }

            element.appendChild(parseInlineTokens(inner));
            fragment.appendChild(element);
            idx = closeIndex + token.length;
        }

        return fragment;
    }

    /**
     * Find the next inline token candidate
     */
    function findNextInlineToken(text, startIndex) {
        const tokens = [
            { type: 'code', delimiter: '`' },
            { type: 'underline', delimiter: '<u>' },
            { type: 'bold', delimiter: '**' },
            { type: 'bold', delimiter: '__' },
            { type: 'strikethrough', delimiter: '~~' },
            { type: 'italic', delimiter: '*' },
            { type: 'italic', delimiter: '_' }
        ];

        let best = null;

        tokens.forEach((token) => {
            const foundIdx = findTokenIndex(text, token.delimiter, startIndex);
            if (foundIdx === -1) return;
            const length = token.delimiter.length;
            if (!best || foundIdx < best.index || (foundIdx === best.index && length > best.length)) {
                best = {
                    ...token,
                    index: foundIdx,
                    length
                };
            }
        });

        return best;
    }

    /**
     * Find token index, skipping escaped delimiters
     */
    function findTokenIndex(text, delimiter, startIndex) {
        let idx = text.indexOf(delimiter, startIndex);
        while (idx !== -1) {
            if (idx > 0 && text[idx - 1] === '\\') {
                idx = text.indexOf(delimiter, idx + delimiter.length);
                continue;
            }
            return idx;
        }
        return -1;
    }

    /**
     * Basic URL sanitizer for preview links
     */
    function sanitizeUrl(url) {
        const trimmed = (url || '').trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
            return trimmed;
        }

        try {
            const parsed = new URL(trimmed, window.location.origin);
            if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
                return parsed.href;
            }
        } catch (err) {
            return null;
        }

        return null;
    }

    function renderImageBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'image-block';

        const img = EditUtils.createImageElement(block, (element, blk) => {
            EditMedia.select(element, blk, index);
        });

        container.appendChild(img);
        return container;
    }

    function renderVideoBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'video-block';

        const videoContainer = EditUtils.createVideoElement(block, (element, blk) => {
            EditMedia.select(element, blk, index);
        });

        container.appendChild(videoContainer);
        return container;
    }

    function renderDetailsBlock(block, _index) {
        const container = document.createElement('div');
        container.className = 'details-block';

        // Summary input
        const summaryLabel = document.createElement('label');
        summaryLabel.textContent = 'Summary:';
        summaryLabel.className = 'details-label';

        const summaryInput = document.createElement('input');
        summaryInput.type = 'text';
        summaryInput.className = 'details-summary-input';
        summaryInput.value = block.summary;
        summaryInput.placeholder = 'Click to expand';
        summaryInput.addEventListener('input', () => {
            EditUndo.saveTextChange(currentBlocks);
            block.summary = summaryInput.value;
        });

        // Body textarea
        const bodyLabel = document.createElement('label');
        bodyLabel.textContent = 'Content:';
        bodyLabel.className = 'details-label';

        const bodyTextarea = document.createElement('textarea');
        bodyTextarea.className = 'details-body-textarea';
        bodyTextarea.value = block.body;
        bodyTextarea.placeholder = 'Content shown when expanded...';
        bodyTextarea.rows = 4;

        // Insert toolbar for adding images/videos
        const insertToolbar = document.createElement('div');
        insertToolbar.className = 'details-insert-toolbar';

        const insertImageBtn = document.createElement('button');
        insertImageBtn.type = 'button';
        insertImageBtn.className = 'details-insert-btn';
        insertImageBtn.textContent = '+ Image';
        insertImageBtn.addEventListener('click', () => {
            EditMedia.uploadImageToMarkdown((markdown) => {
                insertAtCursor(bodyTextarea, markdown);
                block.body = bodyTextarea.value;
            }, showNotification);
        });

        const insertVideoBtn = document.createElement('button');
        insertVideoBtn.type = 'button';
        insertVideoBtn.className = 'details-insert-btn';
        insertVideoBtn.textContent = '+ Video';
        insertVideoBtn.addEventListener('click', () => {
            EditMedia.addVideoToMarkdown((markdown) => {
                insertAtCursor(bodyTextarea, markdown);
                block.body = bodyTextarea.value;
            }, showNotification);
        });

        insertToolbar.appendChild(insertImageBtn);
        insertToolbar.appendChild(insertVideoBtn);

        EditUtils.setupAutoResizeTextarea(bodyTextarea, (value) => {
            EditUndo.saveTextChange(currentBlocks);
            block.body = value;
        });
        bodyTextarea.addEventListener('keydown', (e) => {
            if (EditUtils.handleListShortcuts(e, bodyTextarea, () => {
                block.body = bodyTextarea.value;
            })) return;
            EditUtils.handleFormattingShortcuts(e, bodyTextarea, () => {
                block.body = bodyTextarea.value;
            });
        });

        // Open by default checkbox
        const openLabel = document.createElement('label');
        openLabel.className = 'details-open-label';
        const openCheckbox = document.createElement('input');
        openCheckbox.type = 'checkbox';
        openCheckbox.checked = block.isOpen;
        openCheckbox.addEventListener('change', () => {
            EditUndo.saveState(currentBlocks, 'toggle details');
            block.isOpen = openCheckbox.checked;
        });
        openLabel.appendChild(openCheckbox);
        openLabel.appendChild(document.createTextNode(' Open by default'));

        container.appendChild(summaryLabel);
        container.appendChild(summaryInput);
        container.appendChild(bodyLabel);
        container.appendChild(insertToolbar);
        container.appendChild(bodyTextarea);
        container.appendChild(openLabel);

        return container;
    }

    /**
     * Insert text at cursor position in a textarea
     * @param {HTMLTextAreaElement} textarea
     * @param {string} text
     */
    function insertAtCursor(textarea, text) {
        const pos = textarea.selectionStart;
        const before = textarea.value.substring(0, pos);
        const after = textarea.value.substring(textarea.selectionEnd);
        textarea.value = before + text + after;
        textarea.selectionStart = textarea.selectionEnd = pos + text.length;
        textarea.focus({ preventScroll: true });
        // Trigger resize
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function renderCalloutBlock(block, _index) {
        const container = document.createElement('div');
        container.className = 'callout-block';

        const textarea = document.createElement('textarea');
        textarea.className = 'callout-textarea';
        textarea.value = block.content;
        textarea.placeholder = 'Callout text...';

        EditUtils.setupAutoResizeTextarea(textarea, (value) => {
            EditUndo.saveTextChange(currentBlocks);
            block.content = value;
        });
        textarea.addEventListener('keydown', (e) => {
            if (EditUtils.handleListShortcuts(e, textarea, () => {
                block.content = textarea.value;
            })) return;
            EditUtils.handleFormattingShortcuts(e, textarea, () => {
                block.content = textarea.value;
            });
        });

        container.appendChild(textarea);
        return container;
    }

    function renderDividerBlock(_block, _index) {
        const container = document.createElement('div');
        container.className = 'divider-block';

        const hr = document.createElement('hr');
        container.appendChild(hr);

        return container;
    }

    function renderRowBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'row-block';

        // Row toolbar with swap and split buttons
        const toolbar = document.createElement('div');
        toolbar.className = 'row-toolbar';

        const swapBtn = document.createElement('button');
        swapBtn.className = 'row-action-btn';
        swapBtn.innerHTML = '⇄ Swap';
        swapBtn.title = 'Swap columns';
        swapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            swapRowColumns(block);
        });

        const splitBtn = document.createElement('button');
        splitBtn.className = 'row-action-btn';
        splitBtn.innerHTML = '↕ Split';
        splitBtn.title = 'Split into separate blocks';
        splitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            splitRow(index);
        });

        toolbar.appendChild(swapBtn);
        toolbar.appendChild(splitBtn);

        // Columns container
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'row-columns';

        const leftCol = document.createElement('div');
        leftCol.className = 'row-column row-column-left';
        leftCol.appendChild(renderColumnContent(block.left, index, 'left'));

        const rightCol = document.createElement('div');
        rightCol.className = 'row-column row-column-right';
        rightCol.appendChild(renderColumnContent(block.right, index, 'right'));

        columnsContainer.appendChild(leftCol);
        columnsContainer.appendChild(rightCol);

        container.appendChild(toolbar);
        container.appendChild(columnsContainer);

        return container;
    }

    function renderColumnContent(block, rowIndex, side) {
        const wrapper = document.createElement('div');
        wrapper.className = 'column-block-wrapper';

        switch (block.type) {
            case 'text':
                wrapper.appendChild(renderColumnTextBlock(block, rowIndex, side));
                break;
            case 'image':
                wrapper.appendChild(renderColumnImageBlock(block, rowIndex, side));
                break;
            case 'video':
                wrapper.appendChild(renderColumnVideoBlock(block, rowIndex, side));
                break;
            case 'details':
                wrapper.appendChild(renderDetailsBlock(block, rowIndex));
                break;
            default:
                wrapper.appendChild(renderColumnTextBlock(block, rowIndex, side));
        }

        return wrapper;
    }

    function renderColumnTextBlock(block, _rowIndex, _side) {
        const container = document.createElement('div');
        container.className = 'text-block column-text-block';
        container.appendChild(createLineEditor(block, _rowIndex));
        return container;
    }

    function renderColumnImageBlock(block, rowIndex, side) {
        const container = document.createElement('div');
        container.className = 'image-block column-image-block';

        const img = EditUtils.createImageElement(block, (element, blk) => {
            EditMedia.select(element, blk, rowIndex, side);
        });

        container.appendChild(img);
        return container;
    }

    function renderColumnVideoBlock(block, rowIndex, side) {
        const container = document.createElement('div');
        container.className = 'video-block column-video-block';

        const videoContainer = EditUtils.createVideoElement(block, (element, blk) => {
            EditMedia.select(element, blk, rowIndex, side);
        });

        container.appendChild(videoContainer);
        return container;
    }

    // ========== ROW OPERATIONS ==========

    function swapRowColumns(block) {
        // Save state for undo
        EditUndo.saveState(currentBlocks, 'swap columns');

        const temp = block.left;
        block.left = block.right;
        block.right = temp;
        reRenderBlocks();
        showNotification('Columns swapped');
    }

    function splitRow(rowIndex) {
        const rowBlock = currentBlocks[rowIndex];
        if (rowBlock.type !== 'row') return;

        // Save state for undo
        EditUndo.saveState(currentBlocks, 'split row');

        currentBlocks.splice(rowIndex, 1, rowBlock.left, rowBlock.right);
        reRenderBlocks();
        showNotification('Row split into separate blocks');
    }

    // ========== DRAG AND DROP ==========

    function handleDragStart(e, index) {
        draggedBlockIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());

        setTimeout(() => {
            const wrapper = document.querySelector(`[data-block-index="${index}"]`);
            if (wrapper) wrapper.classList.add('dragging');
        }, 0);

        if (!dropIndicator) {
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            document.body.appendChild(dropIndicator);
        }
    }

    function handleDragEnd() {
        document.querySelectorAll('.block-wrapper.dragging').forEach(el => {
            el.classList.remove('dragging');
        });

        if (dropIndicator) {
            dropIndicator.style.display = 'none';
        }

        draggedBlockIndex = null;
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedBlockIndex === null || draggedBlockIndex === index) return;

        const wrapper = document.querySelector(`[data-block-index="${index}"]`);
        if (wrapper && dropIndicator) {
            const rect = wrapper.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;

            dropIndicator.style.display = 'block';
            dropIndicator.style.left = `${rect.left}px`;
            dropIndicator.style.width = `${rect.width}px`;

            if (e.clientY < midY) {
                dropIndicator.style.top = `${rect.top - 2}px`;
                wrapper.dataset.dropPosition = 'before';
            } else {
                dropIndicator.style.top = `${rect.bottom - 2}px`;
                wrapper.dataset.dropPosition = 'after';
            }
        }
    }

    function handleDrop(e, targetIndex) {
        e.preventDefault();

        if (draggedBlockIndex === null || draggedBlockIndex === targetIndex) return;

        // Save state for undo
        EditUndo.saveState(currentBlocks, 'reorder blocks');

        const wrapper = document.querySelector(`[data-block-index="${targetIndex}"]`);
        const dropPosition = wrapper?.dataset.dropPosition || 'after';

        const draggedBlock = currentBlocks[draggedBlockIndex];
        currentBlocks.splice(draggedBlockIndex, 1);

        let newIndex = targetIndex;
        if (draggedBlockIndex < targetIndex) {
            newIndex = targetIndex - 1;
        }
        if (dropPosition === 'after') {
            newIndex++;
        }

        currentBlocks.splice(newIndex, 0, draggedBlock);
        reRenderBlocks();

        if (dropIndicator) {
            dropIndicator.style.display = 'none';
        }
    }

    function reRenderBlocks() {
        const card = STATE.cardElements[STATE.editingCardIndex];
        const existingEditor = card.querySelector('.block-editor');
        const newEditor = renderBlockEditor(currentBlocks, card);

        if (existingEditor) {
            card.replaceChild(newEditor, existingEditor);
        }
    }

    // ========== BLOCK OPERATIONS ==========

    function deleteBlock(index, columnSide = null) {
        // Save state for undo
        EditUndo.saveState(currentBlocks, 'delete block');

        // Check if deleting a column within a row
        const block = currentBlocks[index];
        if (columnSide && block && block.type === 'row') {
            // Preserve the other column by replacing the row with it
            const remainingBlock = columnSide === 'left' ? block.right : block.left;

            // If deleting selected media, deselect first
            const selected = EditMedia.getSelected();
            if (selected && selected.blockIndex === index) {
                EditMedia.deselect();
            }

            currentBlocks.splice(index, 1, remainingBlock);
            reRenderBlocks();
            showNotification('Column deleted');
            return;
        }

        if (currentBlocks.length <= 1) {
            showNotification('Cannot delete the last block', true);
            return;
        }

        // If deleting selected media, deselect first
        const selected = EditMedia.getSelected();
        if (selected && selected.blockIndex === index) {
            EditMedia.deselect();
        }

        currentBlocks.splice(index, 1);
        reRenderBlocks();
        showNotification('Block deleted');
    }

    function insertBlockAfter(index, block) {
        // Save state for undo
        EditUndo.saveState(currentBlocks, 'insert block');

        currentBlocks.splice(index + 1, 0, block);
        reRenderBlocks();

        // Focus the new block's first editable element
        focusBlock(block.id);
    }

    function focusBlock(blockId) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            const wrapper = document.querySelector(`[data-block-id="${blockId}"]`);
            if (!wrapper) return;

            // For line editor blocks: activate the first line via its click handler
            const firstLine = wrapper.querySelector('.text-block-line');
            if (firstLine) {
                firstLine.click();
                return;
            }

            // Fallback for other block types (details, callout, etc.)
            const focusable = wrapper.querySelector('textarea, input[type="text"]');
            if (focusable) {
                focusable.focus({ preventScroll: true });
            }
        });
    }

    function showAddBlockMenu(insertIndex) {
        const addBtn = document.querySelector('.add-block-btn');
        if (addBtn) {
            EditSlash.showFromButton(addBtn.getBoundingClientRect(), insertIndex - 1);
        }
    }

    // ========== EDIT MODE MANAGEMENT ==========

    function createGlobalToolbar() {
        if (globalToolbar) return globalToolbar;

        const toolbar = document.createElement('div');
        toolbar.className = 'edit-toolbar';
        toolbar.style.display = 'none';
        toolbar.innerHTML = `
            <button class="cancel-btn">✕ Cancel</button>
            <button class="save-btn">💾 Save</button>
            <button class="delete-card-btn">🗑 Delete</button>
        `;

        document.body.appendChild(toolbar);
        globalToolbar = toolbar;
        return toolbar;
    }

    function addEditButtonToCard(card, cardIndex) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-card-btn';
        editBtn.innerHTML = '✎ Edit';
        editBtn.dataset.cardIndex = cardIndex;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Read from data attribute so re-indexing after deletion works
            const idx = parseInt(e.currentTarget.dataset.cardIndex, 10);
            enterEditMode(idx);
        });

        card.appendChild(editBtn);
    }

    async function enterEditMode(cardIndex) {
        if (STATE.editingCardIndex !== -1) {
            showNotification('Please save or cancel current edits first', true);
            return;
        }

        // Set immediately to prevent race condition from rapid clicks
        STATE.editingCardIndex = cardIndex;

        // Load edit mode CSS on first use
        await loadEditModeCSS();

        // Show reorder strip
        if (window.EditReorder) {
            EditReorder.init(STATE, {
                parseMarkdown,
                showNotification,
                saveAndNavigate: async (newIndex) => {
                    if (STATE.editingCardIndex === -1) return;

                    const currentEditingIndex = STATE.editingCardIndex;

                    // Save current card (this calls exitEditMode, setting STATE.editingCardIndex = -1)
                    await saveCard(currentEditingIndex);

                    // If save failed, editingCardIndex will still be set - don't proceed
                    if (STATE.editingCardIndex !== -1) return;

                    // Navigate to new card
                    STATE.currentIndex = newIndex;
                    const params = new URLSearchParams(window.location.search);
                    params.set('card', newIndex);
                    window.history.replaceState(null, '', '?' + params.toString());
                    window.dispatchEvent(new CustomEvent('cardNavigated'));

                    // Enter edit mode on new card
                    await enterEditMode(newIndex);
                }
            });
            EditReorder.show();
        }

        const card = STATE.cardElements[cardIndex];
        STATE.originalCardContent = STATE.cards[cardIndex];

        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.set('editing', 'true');
        window.history.replaceState(null, '', '?' + params.toString());

        // Hide presenter button during edit mode
        const presenterBtn = document.getElementById('presenter-btn');
        if (presenterBtn) presenterBtn.style.display = 'none';

        // Initialize media module with undo callback
        EditMedia.init({
            sessionFile: STATE.sessionFile,
            onBeforeChange: (type) => {
                EditUndo.saveState(currentBlocks, type);
            }
        });

        // Set current cohort for link dialog session discovery
        EditUtils.setCurrentCohort(STATE.cohort);

        // Initialize slash commands
        initSlashCommands();

        // Parse content into blocks
        currentBlocks = EditBlocks.parseIntoBlocks(STATE.cards[cardIndex]);

        // Initialize undo system
        EditUndo.init();

        // Clear card and render block editor
        card.innerHTML = '';
        card.classList.add('editing');
        card.appendChild(renderBlockEditor(currentBlocks, card));

        // Show toolbar with fresh event listeners
        const toolbar = createGlobalToolbar();
        toolbar.style.display = 'flex';

        // Abort previous listeners if any
        if (toolbarAbortController) {
            toolbarAbortController.abort();
        }
        toolbarAbortController = new AbortController();

        toolbar.querySelector('.delete-card-btn').addEventListener('click',
            () => deleteCard(STATE.editingCardIndex),
            { signal: toolbarAbortController.signal }
        );
        toolbar.querySelector('.save-btn').addEventListener('click',
            () => saveCard(STATE.editingCardIndex),
            { signal: toolbarAbortController.signal }
        );
        toolbar.querySelector('.cancel-btn').addEventListener('click',
            () => cancelEdit(STATE.editingCardIndex),
            { signal: toolbarAbortController.signal }
        );

        // Click outside to deselect media
        cardClickHandler = (e) => {
            if (!e.target.closest('.image-block') &&
                !e.target.closest('.video-block') &&
                !e.target.closest('.resize-handle')) {
                EditMedia.deselect();
            }
        };
        card.addEventListener('click', cardClickHandler);
    }

    function exitEditMode(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.delete('editing');
        window.history.replaceState(null, '', '?' + params.toString());

        // Clean up event listeners
        if (toolbarAbortController) {
            toolbarAbortController.abort();
            toolbarAbortController = null;
        }
        if (cardClickHandler && card) {
            card.removeEventListener('click', cardClickHandler);
            cardClickHandler = null;
        }

        // Clean up modules
        EditMedia.cleanup();
        EditSlash.hide();

        // Hide reorder strip
        if (window.EditReorder) {
            EditReorder.hide();
        }

        // Hide toolbar
        if (globalToolbar) globalToolbar.style.display = 'none';

        // Show presenter button again
        const presenterBtn = document.getElementById('presenter-btn');
        if (presenterBtn) presenterBtn.style.display = '';

        // Clean up DOM elements
        if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
        }

        // Remove editing state
        card.classList.remove('editing');
        STATE.editingCardIndex = -1;
        STATE.originalCardContent = null;
        currentBlocks = [];
    }

    function cancelEdit(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Clean up uploaded images
        EditMedia.cleanupUploadedImages();

        // Restore original content
        card.innerHTML = parseMarkdown(STATE.originalCardContent);
        addEditButtonToCard(card, cardIndex);

        exitEditMode(cardIndex);
        showNotification('Changes discarded', 'warning');
    }

    async function deleteCard(cardIndex) {
        // Check if this is the only card
        if (STATE.cards.length <= 1) {
            showNotification('Cannot delete the only card', true);
            return;
        }

        // Confirm deletion
        if (!confirm('Delete this card? This cannot be undone.')) {
            return;
        }

        const card = STATE.cardElements[cardIndex];

        try {
            const response = await fetch('/api/delete-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionFile: STATE.sessionFile,
                    cardIndex: cardIndex,
                    cohort: STATE.cohort,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to delete');
            }

            // Clean up edit mode first
            EditMedia.cleanupUploadedImages();
            exitEditMode(cardIndex);

            // Remove card from STATE arrays
            STATE.cards.splice(cardIndex, 1);
            STATE.cardElements.splice(cardIndex, 1);

            // Remove card DOM element
            card.remove();

            // Navigate to appropriate card
            if (cardIndex >= STATE.cards.length) {
                // Deleted last card, go to new last
                STATE.currentIndex = STATE.cards.length - 1;
            } else if (cardIndex <= STATE.currentIndex && STATE.currentIndex > 0) {
                // Deleted card before or at current position
                STATE.currentIndex = Math.max(0, STATE.currentIndex - 1);
            }

            // Re-index remaining cards and their edit buttons
            STATE.cardElements.forEach((cardEl, idx) => {
                const editBtn = cardEl.querySelector('.edit-card-btn');
                if (editBtn) {
                    editBtn.dataset.cardIndex = idx;
                }
            });

            // Update URL and card stack
            const params = new URLSearchParams(window.location.search);
            params.set('card', STATE.currentIndex);
            params.delete('editing');
            window.history.replaceState(null, '', '?' + params.toString());

            // Trigger stack update (call the updateCardStack from viewer.js via custom event)
            window.dispatchEvent(new CustomEvent('cardDeleted'));

            showNotification('Card deleted');

        } catch (error) {
            console.error('Delete error:', error);
            showNotification(`Error: ${error.message}`, true);
        }
    }

    async function saveCard(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Convert blocks back to markdown
        const markdownContent = EditBlocks.blocksToMarkdown(currentBlocks);

        try {
            const response = await fetch('/api/update-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionFile: STATE.sessionFile,
                    cardIndex: cardIndex,
                    content: markdownContent,
                    uploadedImages: EditMedia.getUploadedImages(),
                    cohort: STATE.cohort,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save');
            }

            // Update state
            STATE.cards[cardIndex] = markdownContent;

            // Re-render card
            card.innerHTML = parseMarkdown(markdownContent);
            addEditButtonToCard(card, cardIndex);

            // Load images for the updated card (parseMarkdown uses data-src for lazy loading)
            if (updateCardMedia) updateCardMedia();

            exitEditMode(cardIndex);

            // Clear uploaded images tracking after successful save
            EditMedia.clearUploadedImages();

            showNotification('Card saved successfully!');

            // Show toast if images were cleaned up
            if (result.deletedImages > 0) {
                const s = result.deletedImages === 1 ? '' : 's';
                showNotification(`Cleaned up ${result.deletedImages} unused image${s}`, 'info');
            }

        } catch (error) {
            console.error('Save error:', error);
            showNotification(`Error: ${error.message}`, true);
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========

    function setupEditModeKeyboardShortcuts() {
        // Clean up previous listener if any
        if (globalKeyboardAbortController) {
            globalKeyboardAbortController.abort();
        }
        globalKeyboardAbortController = new AbortController();

        document.addEventListener('keydown', (e) => {
            const isInEditMode = STATE.editingCardIndex !== -1;

            // Handle slash command menu navigation globally
            if (EditSlash.isActive()) {
                if (EditSlash.handleKeydown(e)) return;
            }

            // Enter edit mode
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                if (!isInEditMode) {
                    enterEditMode(STATE.currentIndex);
                }
            }

            // Save
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && isInEditMode) {
                e.preventDefault();
                saveCard(STATE.editingCardIndex);
            }

            // Undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && isInEditMode) {
                // Only handle if not focused in a textarea (let browser handle native undo there)
                if (!document.activeElement.matches('textarea, input')) {
                    e.preventDefault();
                    const previousState = EditUndo.undo(currentBlocks);
                    if (previousState) {
                        currentBlocks = previousState;
                        reRenderBlocks();
                    }
                }
            }

            // Redo (Ctrl+Shift+Z or Ctrl+Y)
            if ((e.metaKey || e.ctrlKey) && isInEditMode &&
                ((e.shiftKey && e.key === 'z') || (!e.shiftKey && e.key === 'y'))) {
                if (!document.activeElement.matches('textarea, input')) {
                    e.preventDefault();
                    const nextState = EditUndo.redo(currentBlocks);
                    if (nextState) {
                        currentBlocks = nextState;
                        reRenderBlocks();
                    }
                }
            }

            // Cancel
            if (e.key === 'Escape' && isInEditMode) {
                if (EditSlash.isActive()) {
                    EditSlash.hide();
                } else {
                    cancelEdit(STATE.editingCardIndex);
                }
            }

            // Delete selected media
            if (isInEditMode && EditMedia.getSelected() && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (!document.activeElement.matches('textarea, input')) {
                    e.preventDefault();
                    const selected = EditMedia.getSelected();
                    deleteBlock(selected.blockIndex, selected.columnSide);
                }
            }
        }, { signal: globalKeyboardAbortController.signal });
    }

    // ========== PUBLIC API ==========

    return {
        addEditButtonToCard,
        enterEditMode,
        setupEditModeKeyboardShortcuts,
    };
}

// Make available globally
window.initEditMode = initEditMode;
