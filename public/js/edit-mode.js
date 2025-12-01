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
            if (action === 'updateContent' && data.index !== null) {
                currentBlocks[data.index].content = data.content;
            } else if (action === 'execute') {
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
                EditMedia.showImageUploader(insertIndex, (idx, block) => {
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

        const textarea = document.createElement('textarea');
        textarea.className = 'block-textarea';
        textarea.value = block.content;
        textarea.placeholder = 'Type markdown here...';

        // Apply initial alignment
        if (block.align) {
            EditUtils.applyTextAlignment(textarea, block.align);
        }

        // Setup auto-resize and content sync
        EditUtils.setupAutoResizeTextarea(textarea, (value) => {
            EditUndo.saveTextChange(currentBlocks);
            block.content = value;
        });

        // Slash command, list, and formatting shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (EditSlash.isActive()) {
                if (EditSlash.handleKeydown(e)) return;
            }
            // Handle list shortcuts (Enter, Tab, Shift+Tab)
            if (EditUtils.handleListShortcuts(e, textarea, () => {
                block.content = textarea.value;
            })) return;
            // Handle formatting shortcuts (Cmd+B/I/U/K)
            EditUtils.handleFormattingShortcuts(e, textarea, () => {
                block.content = textarea.value;
            });
        });
        textarea.addEventListener('input', () => {
            EditSlash.handleTextareaInput(textarea, index);
        });

        // Alignment toolbar on focus
        textarea.addEventListener('focus', () => {
            EditMedia.showTextAlignmentToolbar(textarea, block, () => {
                // No action needed - alignment is already applied
            });
        });

        // Hide alignment toolbar on blur (with delay to allow button clicks)
        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                // Only hide if focus didn't move to toolbar button
                if (!document.activeElement?.closest('.alignment-toolbar')) {
                    EditMedia.hideTextAlignmentToolbar();
                }
            }, 100);
        });

        container.appendChild(textarea);
        return container;
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
        textarea.focus();
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

        const textarea = document.createElement('textarea');
        textarea.className = 'block-textarea';
        textarea.value = block.content;
        textarea.placeholder = 'Type markdown here...';

        // Apply initial alignment
        if (block.align) {
            EditUtils.applyTextAlignment(textarea, block.align);
        }

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

        // Alignment toolbar on focus
        textarea.addEventListener('focus', () => {
            EditMedia.showTextAlignmentToolbar(textarea, block, () => {
                // No action needed - alignment is already applied
            });
        });

        // Hide alignment toolbar on blur (with delay to allow button clicks)
        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                // Only hide if focus didn't move to toolbar button
                if (!document.activeElement?.closest('.alignment-toolbar')) {
                    EditMedia.hideTextAlignmentToolbar();
                }
            }, 100);
        });

        container.appendChild(textarea);
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

            // Find first focusable element (textarea or input)
            const focusable = wrapper.querySelector('textarea, input[type="text"]');
            if (focusable) {
                focusable.focus();
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
