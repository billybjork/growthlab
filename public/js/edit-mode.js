/**
 * Edit Mode Module for GrowthLab Viewer
 * Block-based editor: text blocks show raw markdown, media blocks render for resizing
 */

function initEditMode(STATE, { parseMarkdown, isDevMode }) {
    if (!isDevMode) return;

    // ========== CONSTANTS ==========

    const BLOCK_SEPARATOR = '<!-- block -->';

    const NOTIFICATION_CONFIG = {
        FADE_IN_DELAY_MS: 10,
        DISPLAY_DURATION_MS: 3000,
        FADE_OUT_DURATION_MS: 300
    };

    const RESIZE_CONFIG = {
        MIN_WIDTH_PERCENT: 20,
        MAX_WIDTH_PERCENT: 100,
        HANDLE_POSITIONS: ['nw', 'ne', 'sw', 'se']
    };

    const SLASH_COMMAND_CONFIG = {
        MENU_WIDTH: 240
    };

    // ========== STATE ==========

    let globalToolbar = null;
    let slashCommandMenu = null;
    let slashCommandActive = false;
    let slashCommandQuery = '';
    let selectedCommandIndex = 0;
    let currentBlocks = [];
    let activeTextareaIndex = null;

    // Resize state
    let selectedMedia = null;
    let resizeHandles = [];
    let isResizing = false;
    let resizeState = {};

    // Alignment toolbar state
    let alignmentToolbar = null;

    // Drag state
    let draggedBlockIndex = null;
    let dropIndicator = null;

    // Upload tracking (for cleanup on cancel)
    let sessionUploadedImages = [];

    // Event listener tracking for cleanup
    let toolbarAbortController = null;
    let cardClickHandler = null;

    // ========== NOTIFICATION SYSTEM ==========

    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `edit-notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), NOTIFICATION_CONFIG.FADE_IN_DELAY_MS);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), NOTIFICATION_CONFIG.FADE_OUT_DURATION_MS);
        }, NOTIFICATION_CONFIG.DISPLAY_DURATION_MS);
    }

    // ========== BLOCK PARSER ==========

    /**
     * Parse alignment from inline style string
     * @param {string|null} style - CSS style string
     * @returns {string} - 'left', 'center', or 'right'
     */
    function parseAlignmentFromStyle(style) {
        if (!style) return 'left';
        const hasMarginLeft = style.includes('margin-left: auto') || style.includes('margin-left:auto');
        const hasMarginRight = style.includes('margin-right: auto') || style.includes('margin-right:auto');

        if (hasMarginLeft && hasMarginRight) return 'center';
        if (hasMarginLeft) return 'right';
        return 'left';
    }

    /**
     * Parse markdown content into blocks separated by <!-- block -->
     * Detects block types: text, image, video, details
     * Handles various whitespace patterns around the separator
     */
    function parseIntoBlocks(markdown) {
        // Split on block separator with flexible whitespace (1+ newlines on each side)
        const rawBlocks = markdown.split(new RegExp(`\\n+${BLOCK_SEPARATOR}\\n+`));

        return rawBlocks.map((content, index) => {
            const trimmed = content.trim();
            const block = {
                id: `block-${Date.now()}-${index}`,
                content: content
            };

            // Detect block type
            if (trimmed.startsWith('<details')) {
                block.type = 'details';
                // Parse details structure
                const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/s);
                const bodyMatch = trimmed.match(/<\/summary>([\s\S]*)<\/details>/);
                block.summary = summaryMatch ? summaryMatch[1].trim() : 'Click to expand';
                block.body = bodyMatch ? bodyMatch[1].trim() : '';
                block.isOpen = trimmed.includes('<details open');
            } else if (trimmed.startsWith('<img') || /^!\[.*?\]\(.*?\)$/.test(trimmed)) {
                block.type = 'image';
                // Parse image - could be markdown or HTML
                if (trimmed.startsWith('<img')) {
                    const srcMatch = trimmed.match(/src="([^"]*)"/);
                    const altMatch = trimmed.match(/alt="([^"]*)"/);
                    const styleMatch = trimmed.match(/style="([^"]*)"/);
                    block.src = srcMatch ? srcMatch[1] : '';
                    block.alt = altMatch ? altMatch[1] : '';
                    block.style = styleMatch ? styleMatch[1] : null;
                    block.align = parseAlignmentFromStyle(block.style);
                } else {
                    const mdMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
                    block.src = mdMatch ? mdMatch[2] : '';
                    block.alt = mdMatch ? mdMatch[1] : '';
                    block.style = null;
                    block.align = 'left';
                }
            } else if (trimmed.startsWith('!video(') || trimmed.startsWith('<div class="video-container"')) {
                block.type = 'video';
                // Parse video - could be custom syntax or HTML
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
                    block.align = parseAlignmentFromStyle(block.style);
                }
            } else {
                block.type = 'text';
            }

            return block;
        });
    }

    /**
     * Convert blocks back to markdown string
     * Uses double newlines around separator to ensure proper markdown block parsing
     */
    function blocksToMarkdown(blocks) {
        return blocks.map(block => {
            switch (block.type) {
                case 'text':
                    return block.content.trim();
                case 'image':
                    return formatImageMarkdown(block);
                case 'video':
                    return formatVideoMarkdown(block);
                case 'details':
                    return formatDetailsHtml(block);
                default:
                    return block.content.trim();
            }
        }).join(`\n\n${BLOCK_SEPARATOR}\n\n`);
    }

    function formatImageMarkdown(block) {
        const hasSize = block.style && (block.style.includes('width') || block.style.includes('max-width'));
        const hasAlignment = block.align && block.align !== 'left';

        if (hasSize || hasAlignment) {
            // Build style string
            let styleParts = ['display: block'];

            // Add sizing (strip any existing alignment margins first)
            if (block.style) {
                const sizeStyle = block.style
                    .replace(/margin-left:\s*auto;?\s*/g, '')
                    .replace(/margin-right:\s*auto;?\s*/g, '')
                    .replace(/display:\s*block;?\s*/g, '')
                    .trim();
                if (sizeStyle) styleParts.push(sizeStyle);
            }

            // Add alignment
            const alignStyle = getAlignmentStyle(block.align);
            if (alignStyle) styleParts.push(alignStyle);

            const finalStyle = styleParts.join('; ');
            return `<img src="${block.src}" alt="${block.alt || ''}" style="${finalStyle}">`;
        }
        // Use markdown syntax for unsized, left-aligned images
        return `![${block.alt || ''}](${block.src})`;
    }

    function formatVideoMarkdown(block) {
        const hasSize = block.style && (block.style.includes('width') || block.style.includes('max-width'));
        const hasAlignment = block.align && block.align !== 'left';

        if (hasSize || hasAlignment) {
            // Build style string
            let styleParts = [];

            // Add sizing (strip any existing alignment margins first)
            if (block.style) {
                const sizeStyle = block.style
                    .replace(/margin-left:\s*auto;?\s*/g, '')
                    .replace(/margin-right:\s*auto;?\s*/g, '')
                    .trim();
                if (sizeStyle) styleParts.push(sizeStyle);
            }

            // Add alignment
            const alignStyle = getAlignmentStyle(block.align);
            if (alignStyle) styleParts.push(alignStyle);

            const finalStyle = styleParts.join('; ');
            return `<div class="video-container" style="${finalStyle}"><iframe src="${block.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        // Use custom syntax for unsized, left-aligned videos
        return `!video(${block.src})`;
    }

    function formatDetailsHtml(block) {
        const openAttr = block.isOpen ? ' open' : '';
        return `<details${openAttr}>\n<summary>${block.summary}</summary>\n\n${block.body}\n\n</details>`;
    }

    // ========== BLOCK RENDERERS ==========

    function renderBlockEditor(blocks, card) {
        const container = document.createElement('div');
        container.className = 'block-editor';

        blocks.forEach((block, index) => {
            const wrapper = createBlockWrapper(block, index);
            container.appendChild(wrapper);
        });

        // Add "Add Block" button at the end
        const addBlockBtn = document.createElement('button');
        addBlockBtn.className = 'add-block-btn';
        addBlockBtn.innerHTML = '+ Add Block';
        addBlockBtn.addEventListener('click', () => showAddBlockMenu(blocks.length));
        container.appendChild(addBlockBtn);

        return container;
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
            default:
                return renderTextBlock(block, index);
        }
    }

    function renderTextBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'text-block';

        const textarea = document.createElement('textarea');
        textarea.className = 'block-textarea';
        textarea.value = block.content;
        textarea.placeholder = 'Type markdown here...';

        // Auto-resize
        const autoResize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };
        textarea.addEventListener('input', () => {
            autoResize();
            block.content = textarea.value;
        });

        // Setup slash commands for this textarea
        textarea.addEventListener('keydown', (e) => handleTextareaKeydown(e, index));
        textarea.addEventListener('input', () => handleTextareaInput(textarea, index));
        textarea.addEventListener('focus', () => { activeTextareaIndex = index; });

        // Initial resize
        setTimeout(autoResize, 0);

        container.appendChild(textarea);
        return container;
    }

    function renderImageBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'image-block';

        const img = document.createElement('img');
        img.src = block.src;
        img.alt = block.alt || '';
        if (block.style) {
            img.setAttribute('style', block.style);
        }

        // Apply alignment
        if (block.align) {
            applyAlignmentToElement(img, block.align);
        }

        // Make image clickable for resize selection
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            selectMediaElement(img, block, index);
        });

        container.appendChild(img);
        return container;
    }

    function renderVideoBlock(block, index) {
        const container = document.createElement('div');
        container.className = 'video-block';

        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        if (block.style) {
            videoContainer.setAttribute('style', block.style);
        }

        // Apply alignment
        if (block.align) {
            applyAlignmentToElement(videoContainer, block.align);
        }

        const iframe = document.createElement('iframe');
        iframe.src = block.src;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');

        videoContainer.appendChild(iframe);

        // Make video container clickable for resize selection
        videoContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            selectMediaElement(videoContainer, block, index);
        });

        container.appendChild(videoContainer);
        return container;
    }

    function renderDetailsBlock(block, index) {
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
        bodyTextarea.addEventListener('input', () => {
            block.body = bodyTextarea.value;
            // Auto-resize
            bodyTextarea.style.height = 'auto';
            bodyTextarea.style.height = bodyTextarea.scrollHeight + 'px';
        });
        bodyTextarea.addEventListener('keydown', (e) => {
            handleFormattingShortcuts(e, bodyTextarea, () => {
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
            block.isOpen = openCheckbox.checked;
        });
        openLabel.appendChild(openCheckbox);
        openLabel.appendChild(document.createTextNode(' Open by default'));

        container.appendChild(summaryLabel);
        container.appendChild(summaryInput);
        container.appendChild(bodyLabel);
        container.appendChild(bodyTextarea);
        container.appendChild(openLabel);

        return container;
    }

    // ========== DRAG AND DROP ==========

    function handleDragStart(e, index) {
        draggedBlockIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());

        // Add dragging class after a tiny delay (for visual feedback)
        setTimeout(() => {
            const wrapper = document.querySelector(`[data-block-index="${index}"]`);
            if (wrapper) wrapper.classList.add('dragging');
        }, 0);

        // Create drop indicator if it doesn't exist
        if (!dropIndicator) {
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            document.body.appendChild(dropIndicator);
        }
    }

    function handleDragEnd() {
        // Remove dragging class from all blocks
        document.querySelectorAll('.block-wrapper.dragging').forEach(el => {
            el.classList.remove('dragging');
        });

        // Hide drop indicator
        if (dropIndicator) {
            dropIndicator.style.display = 'none';
        }

        draggedBlockIndex = null;
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedBlockIndex === null || draggedBlockIndex === index) return;

        // Show drop indicator
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

        const wrapper = document.querySelector(`[data-block-index="${targetIndex}"]`);
        const dropPosition = wrapper?.dataset.dropPosition || 'after';

        // Reorder blocks
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

        // Re-render
        reRenderBlocks();

        // Hide drop indicator
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

    function deleteBlock(index) {
        if (currentBlocks.length <= 1) {
            showNotification('Cannot delete the last block', true);
            return;
        }

        currentBlocks.splice(index, 1);
        reRenderBlocks();
        showNotification('Block deleted');
    }

    function insertBlockAfter(index, block) {
        currentBlocks.splice(index + 1, 0, block);
        reRenderBlocks();
    }

    function showAddBlockMenu(insertIndex) {
        createSlashCommandMenu();

        slashCommandActive = true;
        activeTextareaIndex = insertIndex - 1; // Insert after this index
        renderSlashCommandMenu(SLASH_COMMANDS, 0);

        const addBtn = document.querySelector('.add-block-btn');
        if (addBtn) {
            positionSlashMenu(addBtn.getBoundingClientRect());
        }
    }

    // ========== SLASH COMMAND SYSTEM ==========

    const SLASH_COMMANDS = [
        { id: 'text', label: 'Text Block', icon: '📝', description: 'Add a text/markdown block' },
        { id: 'image', label: 'Image', icon: '📷', description: 'Upload and insert an image' },
        { id: 'video', label: 'Video', icon: '🎥', description: 'Embed a video (YouTube, Vimeo, etc.)' },
        { id: 'details', label: 'Collapsible Section', icon: '📋', description: 'Add an expandable/collapsible section' }
    ];

    function createSlashCommandMenu() {
        if (slashCommandMenu) return slashCommandMenu;

        const menu = document.createElement('div');
        menu.className = 'slash-command-menu';
        menu.style.display = 'none';
        document.body.appendChild(menu);
        slashCommandMenu = menu;
        return menu;
    }

    /**
     * Position slash command menu relative to an anchor element
     * Handles viewport overflow by positioning above if needed
     */
    function positionSlashMenu(anchorRect) {
        if (!slashCommandMenu) return;

        slashCommandMenu.style.display = 'block';
        slashCommandMenu.style.width = `${SLASH_COMMAND_CONFIG.MENU_WIDTH}px`;
        slashCommandMenu.style.left = `${Math.min(anchorRect.left, window.innerWidth - SLASH_COMMAND_CONFIG.MENU_WIDTH - 20)}px`;

        const menuHeight = slashCommandMenu.offsetHeight || 200;
        const spaceBelow = window.innerHeight - anchorRect.bottom - 10;
        const spaceAbove = anchorRect.top - 10;

        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            slashCommandMenu.style.top = 'auto';
            slashCommandMenu.style.bottom = `${window.innerHeight - anchorRect.top + 5}px`;
            slashCommandMenu.style.maxHeight = `${Math.min(300, spaceAbove)}px`;
        } else {
            slashCommandMenu.style.top = `${anchorRect.bottom + 5}px`;
            slashCommandMenu.style.bottom = 'auto';
            slashCommandMenu.style.maxHeight = `${Math.min(300, spaceBelow)}px`;
        }
    }

    function getFilteredCommands(query) {
        if (!query) return SLASH_COMMANDS;
        const lowerQuery = query.toLowerCase();
        return SLASH_COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.id.toLowerCase().includes(lowerQuery) ||
            cmd.description.toLowerCase().includes(lowerQuery)
        );
    }

    function renderSlashCommandMenu(commands, selectedIndex = 0) {
        if (!slashCommandMenu) createSlashCommandMenu();

        selectedCommandIndex = Math.max(0, Math.min(selectedIndex, commands.length - 1));

        slashCommandMenu.innerHTML = commands.map((cmd, index) => {
            const isSelected = index === selectedCommandIndex;
            return `
                <button
                    class="slash-menu-item ${isSelected ? 'selected' : ''}"
                    data-command="${cmd.id}"
                >
                    <span class="slash-menu-icon">${cmd.icon}</span>
                    <span class="slash-menu-label">${cmd.label}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        slashCommandMenu.querySelectorAll('.slash-menu-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                executeSlashCommand(commands[index].id);
            });
        });
    }

    function showSlashCommandMenu(textarea) {
        if (!slashCommandMenu) createSlashCommandMenu();

        slashCommandActive = true;
        slashCommandQuery = '';
        selectedCommandIndex = 0;

        renderSlashCommandMenu(SLASH_COMMANDS, 0);
        positionSlashMenu(textarea.getBoundingClientRect());
    }

    function hideSlashCommandMenu() {
        if (slashCommandMenu) {
            slashCommandMenu.style.display = 'none';
        }
        slashCommandActive = false;
        slashCommandQuery = '';
        selectedCommandIndex = 0;
    }

    function executeSlashCommand(commandId) {
        const insertIndex = activeTextareaIndex !== null ? activeTextareaIndex : currentBlocks.length - 1;

        // Remove the "/" from the current textarea if we're in one
        if (activeTextareaIndex !== null) {
            const textarea = document.querySelector(`.block-wrapper[data-block-index="${activeTextareaIndex}"] .block-textarea`);
            if (textarea) {
                const cursorPos = textarea.selectionStart;
                const text = textarea.value;
                const slashIndex = text.lastIndexOf('/', cursorPos);
                if (slashIndex !== -1) {
                    const newText = text.substring(0, slashIndex) + text.substring(cursorPos);
                    textarea.value = newText;
                    currentBlocks[activeTextareaIndex].content = newText;
                }
            }
        }

        hideSlashCommandMenu();

        // Execute the command
        switch (commandId) {
            case 'text':
                insertBlockAfter(insertIndex, {
                    id: `block-${Date.now()}`,
                    type: 'text',
                    content: ''
                });
                break;
            case 'image':
                showImageUploader(insertIndex);
                break;
            case 'video':
                addVideo(insertIndex);
                break;
            case 'details':
                insertBlockAfter(insertIndex, {
                    id: `block-${Date.now()}`,
                    type: 'details',
                    summary: 'Click to expand',
                    body: '',
                    isOpen: false
                });
                break;
        }
    }

    function handleSlashMenuKeydown(e) {
        if (!slashCommandActive) return false;

        const filteredCommands = getFilteredCommands(slashCommandQuery);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
                renderSlashCommandMenu(filteredCommands, selectedCommandIndex);
                scrollSelectedIntoView();
                return true;
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
                renderSlashCommandMenu(filteredCommands, selectedCommandIndex);
                scrollSelectedIntoView();
                return true;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                e.stopPropagation();
                if (filteredCommands.length > 0) {
                    executeSlashCommand(filteredCommands[selectedCommandIndex].id);
                }
                return true;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                hideSlashCommandMenu();
                return true;
        }
        return false;
    }

    function scrollSelectedIntoView() {
        if (!slashCommandMenu) return;
        const selected = slashCommandMenu.querySelector('.slash-menu-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function handleFormattingShortcuts(e, textarea, onUpdate) {
        if (!(e.metaKey || e.ctrlKey)) return false;

        switch (e.key) {
            case 'b':
                e.preventDefault();
                wrapSelectionInTextarea(textarea, '**', '**', onUpdate);
                return true;
            case 'i':
                e.preventDefault();
                wrapSelectionInTextarea(textarea, '*', '*', onUpdate);
                return true;
            case 'k':
                e.preventDefault();
                insertLinkInTextarea(textarea, onUpdate);
                return true;
            case 'u':
                e.preventDefault();
                wrapSelectionInTextarea(textarea, '<u>', '</u>', onUpdate);
                return true;
        }
        return false;
    }

    function handleTextareaKeydown(e, index) {
        if (slashCommandActive) {
            if (handleSlashMenuKeydown(e)) return;
        }

        const textarea = e.target;
        handleFormattingShortcuts(e, textarea, () => {
            currentBlocks[index].content = textarea.value;
        });
    }

    function handleTextareaInput(textarea, index) {
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;
        const textBeforeCursor = text.substring(0, cursorPos);

        // Check if "/" was typed at start of line
        const lastNewline = textBeforeCursor.lastIndexOf('\n');
        const lineStart = lastNewline + 1;
        const lineBeforeCursor = textBeforeCursor.substring(lineStart);

        if (lineBeforeCursor === '/') {
            showSlashCommandMenu(textarea);
            return;
        }

        // If slash command is active, update query
        if (slashCommandActive) {
            const slashIndex = textBeforeCursor.lastIndexOf('/');
            if (slashIndex !== -1) {
                const beforeSlash = textBeforeCursor.substring(0, slashIndex);
                const isAtLineStart = beforeSlash === '' || beforeSlash.endsWith('\n');
                if (isAtLineStart) {
                    slashCommandQuery = textBeforeCursor.substring(slashIndex + 1);
                    const filteredCommands = getFilteredCommands(slashCommandQuery);
                    if (filteredCommands.length === 0) {
                        hideSlashCommandMenu();
                    } else {
                        renderSlashCommandMenu(filteredCommands, 0);
                    }
                } else {
                    hideSlashCommandMenu();
                }
            } else {
                hideSlashCommandMenu();
            }
        }
    }

    function insertTextWithUndo(textarea, text) {
        textarea.focus();
        // execCommand preserves native undo stack
        if (!document.execCommand('insertText', false, text)) {
            // Fallback if execCommand fails
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.setRangeText(text, start, end, 'end');
        }
    }

    function wrapSelectionInTextarea(textarea, before, after, onUpdate) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end) || 'text';
        const replacement = before + selectedText + after;

        textarea.focus();
        textarea.setSelectionRange(start, end);
        insertTextWithUndo(textarea, replacement);

        // Adjust selection to just the inner text
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selectedText.length;

        // Update content via callback
        if (onUpdate) onUpdate();
    }

    function insertLinkInTextarea(textarea, onUpdate) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end) || 'link text';

        const url = prompt('Enter URL:');
        if (!url) return;

        const linkText = `[${selectedText}](${url})`;

        textarea.focus();
        textarea.setSelectionRange(start, end);
        insertTextWithUndo(textarea, linkText);

        // Update content via callback
        if (onUpdate) onUpdate();
    }

    // ========== IMAGE UPLOAD ==========

    function showImageUploader(insertAfterIndex) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            await uploadImage(file, insertAfterIndex);
        });

        fileInput.click();
    }

    async function uploadImage(file, insertAfterIndex) {
        showNotification('Uploading image...');

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('sessionId', STATE.sessionFile);

            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Track uploaded image for cleanup on cancel
            sessionUploadedImages.push(result.path);

            // Insert new image block
            insertBlockAfter(insertAfterIndex, {
                id: `block-${Date.now()}`,
                type: 'image',
                src: result.path,
                alt: '',
                style: null,
                content: `![](${result.path})`
            });

            showNotification('Image added!');

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload error: ${error.message}`, true);
        }
    }

    // ========== VIDEO EMBED ==========

    function addVideo(insertAfterIndex) {
        const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
        if (!url) return;

        const embedUrl = convertToEmbedUrl(url);
        if (!embedUrl) {
            showNotification('Invalid video URL', true);
            return;
        }

        insertBlockAfter(insertAfterIndex, {
            id: `block-${Date.now()}`,
            type: 'video',
            src: embedUrl,
            style: null,
            content: `!video(${embedUrl})`
        });

        showNotification('Video added!');
    }

    function convertToEmbedUrl(url) {
        try {
            new URL(url);
        } catch {
            return null;
        }

        // YouTube
        if (url.includes('youtube.com/watch')) {
            const videoId = new URL(url).searchParams.get('v');
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        // Vimeo
        if (url.includes('vimeo.com/') && !url.includes('/video/')) {
            const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
        }

        return url;
    }

    // ========== MEDIA RESIZE & ALIGNMENT ==========

    function selectMediaElement(element, block, blockIndex) {
        deselectMediaElement();

        selectedMedia = { element, block, blockIndex };
        element.classList.add('media-selected');
        createResizeHandles(element);
        createAlignmentToolbar(element, block);
    }

    function deselectMediaElement() {
        if (!selectedMedia) return;

        selectedMedia.element.classList.remove('media-selected');
        removeResizeHandles();
        removeAlignmentToolbar();
        selectedMedia = null;
    }

    // ========== ALIGNMENT TOOLBAR ==========

    function createAlignmentToolbar(element, block) {
        if (alignmentToolbar) removeAlignmentToolbar();

        const toolbar = document.createElement('div');
        toolbar.className = 'alignment-toolbar';

        const alignments = [
            { id: 'left', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align left' },
            { id: 'center', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="4" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align center' },
            { id: 'right', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="7" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align right' }
        ];

        alignments.forEach(({ id, icon, title }) => {
            const btn = document.createElement('button');
            btn.className = `align-btn ${block.align === id ? 'active' : ''}`;
            btn.dataset.align = id;
            btn.title = title;
            btn.innerHTML = icon;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setAlignment(id);
            });
            toolbar.appendChild(btn);
        });

        document.body.appendChild(toolbar);
        alignmentToolbar = toolbar;

        positionAlignmentToolbar(element);
    }

    function positionAlignmentToolbar(element) {
        if (!alignmentToolbar) return;

        const rect = element.getBoundingClientRect();
        const toolbarWidth = 90; // Approximate width
        const toolbarHeight = 32;

        // Position above the element, centered
        let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
        let top = rect.top - toolbarHeight - 8;

        // Keep within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - toolbarWidth - 10));
        if (top < 10) {
            top = rect.bottom + 8; // Position below if no room above
        }

        alignmentToolbar.style.left = `${left}px`;
        alignmentToolbar.style.top = `${top}px`;
    }

    function removeAlignmentToolbar() {
        if (alignmentToolbar) {
            alignmentToolbar.remove();
            alignmentToolbar = null;
        }
    }

    function updateAlignmentToolbarPositions() {
        if (selectedMedia && alignmentToolbar) {
            positionAlignmentToolbar(selectedMedia.element);
        }
    }

    function setAlignment(align) {
        if (!selectedMedia) return;

        const { element, block, blockIndex } = selectedMedia;

        // Update block data
        block.align = align;

        // Apply alignment styles to element
        applyAlignmentToElement(element, align);

        // Update toolbar active state
        if (alignmentToolbar) {
            alignmentToolbar.querySelectorAll('.align-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === align);
            });
        }

        // Reposition toolbar after alignment change
        setTimeout(() => positionAlignmentToolbar(element), 10);
    }

    function applyAlignmentToElement(element, align) {
        // Clear existing alignment margins
        element.style.marginLeft = '';
        element.style.marginRight = '';

        switch (align) {
            case 'center':
                element.style.marginLeft = 'auto';
                element.style.marginRight = 'auto';
                break;
            case 'right':
                element.style.marginLeft = 'auto';
                break;
            case 'left':
            default:
                // No margin needed for left (default)
                break;
        }
    }

    function getAlignmentStyle(align) {
        switch (align) {
            case 'center':
                return 'margin-left: auto; margin-right: auto';
            case 'right':
                return 'margin-left: auto';
            default:
                return '';
        }
    }

    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();

        RESIZE_CONFIG.HANDLE_POSITIONS.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.dataset.position = position;

            positionHandle(handle, position, rect);
            handle.addEventListener('mousedown', (e) => startResize(e, position));

            document.body.appendChild(handle);
            resizeHandles.push(handle);
        });
    }

    function positionHandle(handle, position, rect) {
        handle.style.position = 'fixed';

        const offset = 6;
        switch (position) {
            case 'nw':
                handle.style.top = `${rect.top - offset}px`;
                handle.style.left = `${rect.left - offset}px`;
                break;
            case 'ne':
                handle.style.top = `${rect.top - offset}px`;
                handle.style.left = `${rect.right - offset}px`;
                break;
            case 'sw':
                handle.style.top = `${rect.bottom - offset}px`;
                handle.style.left = `${rect.left - offset}px`;
                break;
            case 'se':
                handle.style.top = `${rect.bottom - offset}px`;
                handle.style.left = `${rect.right - offset}px`;
                break;
        }
    }

    function updateHandlePositions() {
        if (!selectedMedia || resizeHandles.length === 0) return;

        const rect = selectedMedia.element.getBoundingClientRect();
        resizeHandles.forEach(handle => {
            positionHandle(handle, handle.dataset.position, rect);
        });

        // Also update alignment toolbar position
        updateAlignmentToolbarPositions();
    }

    function removeResizeHandles() {
        resizeHandles.forEach(handle => handle.remove());
        resizeHandles = [];
    }

    function startResize(e, position) {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        const element = selectedMedia.element;
        element.classList.add('media-resizing');

        const rect = element.getBoundingClientRect();
        const card = element.closest('.card');
        const cardRect = card.getBoundingClientRect();

        resizeState = {
            position,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            aspectRatio: rect.width / rect.height,
            cardWidth: cardRect.width,
            minWidth: (cardRect.width * RESIZE_CONFIG.MIN_WIDTH_PERCENT) / 100,
            maxWidth: (cardRect.width * RESIZE_CONFIG.MAX_WIDTH_PERCENT) / 100
        };

        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.body.style.userSelect = 'none';
    }

    function handleResize(e) {
        if (!isResizing || !selectedMedia) return;

        const { position, startX, startY, startWidth, aspectRatio, minWidth, maxWidth } = resizeState;

        let deltaX = 0;
        switch (position) {
            case 'se':
            case 'ne':
                deltaX = e.clientX - startX;
                break;
            case 'sw':
            case 'nw':
                deltaX = -(e.clientX - startX);
                break;
        }

        let newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
        const newHeight = newWidth / aspectRatio;

        const element = selectedMedia.element;
        const block = selectedMedia.block;

        if (element.tagName === 'IMG') {
            element.style.maxWidth = `${newWidth}px`;
            element.style.width = `${newWidth}px`;
            element.style.height = 'auto';
            block.style = `max-width: ${newWidth}px; width: ${newWidth}px`;
        } else if (element.classList.contains('video-container')) {
            element.style.maxWidth = `${newWidth}px`;
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
            element.style.paddingBottom = '0';
            block.style = `max-width: ${newWidth}px; width: ${newWidth}px; height: ${newHeight}px; padding-bottom: 0`;
        }

        updateHandlePositions();
    }

    function stopResize() {
        if (!isResizing) return;

        isResizing = false;
        if (selectedMedia) {
            selectedMedia.element.classList.remove('media-resizing');
        }

        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.userSelect = '';
        resizeState = {};
    }

    // ========== EDIT MODE MANAGEMENT ==========

    function createGlobalToolbar() {
        if (globalToolbar) return globalToolbar;

        const toolbar = document.createElement('div');
        toolbar.className = 'edit-toolbar';
        toolbar.style.display = 'none';
        toolbar.innerHTML = `
            <button class="save-btn">💾 Save</button>
            <button class="cancel-btn">✕ Cancel</button>
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
            enterEditMode(cardIndex);
        });

        card.appendChild(editBtn);
    }

    function enterEditMode(cardIndex) {
        if (STATE.editingCardIndex !== -1) {
            showNotification('Please save or cancel current edits first', true);
            return;
        }

        const card = STATE.cardElements[cardIndex];
        STATE.editingCardIndex = cardIndex;
        STATE.originalCardContent = STATE.cards[cardIndex];

        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.set('editing', 'true');
        window.history.replaceState(null, '', '?' + params.toString());

        // Reset upload tracking for this session
        sessionUploadedImages = [];

        // Parse content into blocks
        currentBlocks = parseIntoBlocks(STATE.cards[cardIndex]);

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

        toolbar.querySelector('.save-btn').addEventListener('click', () => saveCard(cardIndex), { signal: toolbarAbortController.signal });
        toolbar.querySelector('.cancel-btn').addEventListener('click', () => cancelEdit(cardIndex), { signal: toolbarAbortController.signal });

        // Create slash command menu
        createSlashCommandMenu();

        // Click outside to deselect media (store handler for cleanup)
        cardClickHandler = (e) => {
            if (!e.target.closest('.image-block') && !e.target.closest('.video-block') && !e.target.closest('.resize-handle')) {
                deselectMediaElement();
            }
        };
        card.addEventListener('click', cardClickHandler);

        // Add resize handle position tracking
        window.addEventListener('scroll', updateHandlePositions, true);
        window.addEventListener('resize', updateHandlePositions);
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
        window.removeEventListener('scroll', updateHandlePositions, true);
        window.removeEventListener('resize', updateHandlePositions);

        // Hide toolbar and menus
        if (globalToolbar) globalToolbar.style.display = 'none';
        hideSlashCommandMenu();
        deselectMediaElement();
        removeAlignmentToolbar();

        // Clean up DOM elements created during edit session
        if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
        }
        if (slashCommandMenu) {
            slashCommandMenu.remove();
            slashCommandMenu = null;
        }

        // Remove editing state
        card.classList.remove('editing');
        STATE.editingCardIndex = -1;
        STATE.originalCardContent = null;
        currentBlocks = [];
        activeTextareaIndex = null;
    }

    function cancelEdit(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Clean up any images uploaded this session
        if (sessionUploadedImages.length > 0) {
            fetch('/api/cleanup-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: sessionUploadedImages })
            }).catch(err => console.warn('Cleanup failed:', err));
        }

        // Restore original content
        card.innerHTML = parseMarkdown(STATE.originalCardContent);
        addEditButtonToCard(card, cardIndex);

        exitEditMode(cardIndex);
        showNotification('Changes discarded');
    }

    async function saveCard(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Convert blocks back to markdown
        const markdownContent = blocksToMarkdown(currentBlocks);

        try {
            const response = await fetch('/api/update-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionFile: STATE.sessionFile,
                    cardIndex: cardIndex,
                    content: markdownContent,
                    uploadedImages: sessionUploadedImages,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save');
            }

            // Update state
            STATE.cards[cardIndex] = markdownContent;

            // Re-render card with parsed markdown
            card.innerHTML = parseMarkdown(markdownContent);
            addEditButtonToCard(card, cardIndex);

            exitEditMode(cardIndex);
            showNotification('Card saved successfully!');

        } catch (error) {
            console.error('Save error:', error);
            showNotification(`Error: ${error.message}`, true);
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========

    function setupEditModeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isInEditMode = STATE.editingCardIndex !== -1;

            // Handle slash command menu navigation globally
            // This catches arrow keys even when menu is opened via Add Block button
            if (slashCommandActive) {
                if (handleSlashMenuKeydown(e)) return;
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

            // Cancel
            if (e.key === 'Escape' && isInEditMode) {
                if (slashCommandActive) {
                    hideSlashCommandMenu();
                } else {
                    cancelEdit(STATE.editingCardIndex);
                }
            }

            // Delete selected media
            if (isInEditMode && selectedMedia && (e.key === 'Delete' || e.key === 'Backspace')) {
                // Only delete if not focused on a textarea/input
                if (!document.activeElement.matches('textarea, input')) {
                    e.preventDefault();
                    deleteBlock(selectedMedia.blockIndex);
                    deselectMediaElement();
                }
            }
        });
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
