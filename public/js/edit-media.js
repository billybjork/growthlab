/**
 * Edit Media Module
 * Handles media selection, resize, alignment, upload, and video embed
 */
window.EditMedia = (function() {
    'use strict';

    // ========== CONFIGURATION ==========

    const RESIZE_CONFIG = {
        MIN_WIDTH_PERCENT: 20,
        MAX_WIDTH_PERCENT: 100,
        HANDLE_POSITIONS: ['nw', 'ne', 'sw', 'se']
    };

    const ALIGNMENT_ICONS = [
        { id: 'left', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="1" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align left' },
        { id: 'center', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="4" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align center' },
        { id: 'right', icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="3" width="10" height="2" rx="0.5"/><rect x="1" y="7" width="14" height="2" rx="0.5"/><rect x="7" y="11" width="8" height="2" rx="0.5"/></svg>', title: 'Align right' }
    ];

    // ========== STATE ==========

    let selectedMedia = null;  // { element, block, blockIndex, columnSide }
    let resizeHandles = [];
    let isResizing = false;
    let resizeState = {};
    let alignmentToolbar = null;

    // Callbacks
    let onBlockUpdateCallback = null;
    let onBeforeChange = null;
    let sessionFile = null;
    let uploadedImages = [];

    // Image picker state
    let imagePickerDialog = null;
    let imagePickerCache = null;

    // ========== SELECTION ==========

    /**
     * Select a media element for editing
     * @param {HTMLElement} element - The img or video-container element
     * @param {Object} block - Block data object
     * @param {number} blockIndex
     * @param {string} columnSide - 'left' or 'right' for row columns, null otherwise
     */
    function select(element, block, blockIndex, columnSide = null) {
        deselect();

        selectedMedia = { element, block, blockIndex, columnSide };
        element.classList.add('media-selected');
        createResizeHandles(element);
        createAlignmentToolbar(element, block);
    }

    /**
     * Deselect currently selected media
     */
    function deselect() {
        if (!selectedMedia) return;

        selectedMedia.element.classList.remove('media-selected');
        removeResizeHandles();
        removeAlignmentToolbar();
        selectedMedia = null;
    }

    /**
     * Get currently selected media info
     * @returns {Object|null}
     */
    function getSelected() {
        return selectedMedia;
    }

    // ========== ALIGNMENT TOOLBAR ==========

    /**
     * Create alignment toolbar above selected media
     * @param {HTMLElement} element
     * @param {Object} block
     */
    function createAlignmentToolbar(element, block, onAlignClick = setAlignment) {
        if (alignmentToolbar) removeAlignmentToolbar();

        const toolbar = document.createElement('div');
        toolbar.className = 'alignment-toolbar';

        ALIGNMENT_ICONS.forEach(({ id, icon, title }) => {
            const btn = document.createElement('button');
            btn.className = `align-btn ${block.align === id ? 'active' : ''}`;
            btn.dataset.align = id;
            btn.title = title;
            btn.innerHTML = icon;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onAlignClick(id);
            });
            toolbar.appendChild(btn);
        });

        document.body.appendChild(toolbar);
        alignmentToolbar = toolbar;

        positionAlignmentToolbar(element);
    }

    /**
     * Position alignment toolbar above element
     * @param {HTMLElement} element
     */
    function positionAlignmentToolbar(element) {
        if (!alignmentToolbar) return;

        const rect = element.getBoundingClientRect();
        const toolbarWidth = 90;
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

    /**
     * Remove alignment toolbar
     */
    function removeAlignmentToolbar() {
        if (alignmentToolbar) {
            alignmentToolbar.remove();
            alignmentToolbar = null;
        }
    }

    /**
     * Set alignment for selected media
     * @param {string} align - 'left', 'center', or 'right'
     */
    function setAlignment(align) {
        if (!selectedMedia) return;

        // Save state for undo before alignment changes
        if (onBeforeChange) onBeforeChange('alignment');

        const { element, block } = selectedMedia;

        // Update block data
        block.align = align;

        // Apply alignment to element
        EditUtils.applyAlignment(element, align);

        // Update toolbar active state
        if (alignmentToolbar) {
            alignmentToolbar.querySelectorAll('.align-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === align);
            });
        }

        // Reposition toolbar after alignment change
        setTimeout(() => positionAlignmentToolbar(element), 10);
    }

    // ========== RESIZE HANDLES ==========

    /**
     * Create resize handles around element
     * @param {HTMLElement} element
     */
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

    /**
     * Position a single handle
     * @param {HTMLElement} handle
     * @param {string} position
     * @param {DOMRect} rect
     */
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

    /**
     * Update all handle positions
     */
    function updateHandlePositions() {
        if (!selectedMedia || resizeHandles.length === 0) return;

        const rect = selectedMedia.element.getBoundingClientRect();
        resizeHandles.forEach(handle => {
            positionHandle(handle, handle.dataset.position, rect);
        });

        // Also update alignment toolbar
        if (alignmentToolbar) {
            positionAlignmentToolbar(selectedMedia.element);
        }
    }

    /**
     * Remove all resize handles
     */
    function removeResizeHandles() {
        resizeHandles.forEach(handle => handle.remove());
        resizeHandles = [];
    }

    // ========== RESIZE LOGIC ==========

    /**
     * Start resize operation
     * @param {MouseEvent} e
     * @param {string} position
     */
    function startResize(e, position) {
        e.preventDefault();
        e.stopPropagation();

        // Save state for undo before resize begins
        if (onBeforeChange) onBeforeChange('resize');

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

    /**
     * Handle resize drag
     * @param {MouseEvent} e
     */
    function handleResize(e) {
        if (!isResizing || !selectedMedia) return;

        const { position, startX, startWidth, aspectRatio, minWidth, maxWidth } = resizeState;

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

    /**
     * Stop resize operation
     */
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

    // ========== IMAGE UPLOAD ==========

    /**
     * Show file picker and upload image
     * @param {number} insertAfterIndex
     * @param {Function} onSuccess - Called with block data on success
     * @param {Function} showNotification - Notification function
     */
    function showImageUploader(insertAfterIndex, onSuccess, showNotification) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            await uploadImage(file, insertAfterIndex, onSuccess, showNotification);
        });

        fileInput.click();
    }

    /**
     * Upload image file to server
     * @param {File} file
     * @param {number} insertAfterIndex
     * @param {Function} onSuccess
     * @param {Function} showNotification
     */
    async function uploadImage(file, insertAfterIndex, onSuccess, showNotification) {
        showNotification('Uploading image...', 'info');

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('sessionId', sessionFile);

            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Track uploaded image for cleanup on cancel (but not duplicates)
            if (!result.duplicate) {
                uploadedImages.push(result.path);
                // Add to image picker cache for immediate availability
                addToImagePickerCache(result.path, sessionFile);
            }

            // Create image block
            const block = EditBlocks.createBlock('image', {
                src: result.path,
                content: `![](${result.path})`
            });

            if (onSuccess) {
                onSuccess(insertAfterIndex, block);
            }

            showNotification(result.duplicate ? 'Image already exists, reusing!' : 'Image added!', result.duplicate ? 'info' : 'success');

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload error: ${error.message}`, true);
        }
    }

    // ========== IMAGE PICKER ==========

    /**
     * Fetch and cache image list from server
     * @returns {Promise<Object>} Images organized by session
     */
    async function fetchImageList() {
        if (imagePickerCache) return imagePickerCache;

        try {
            const response = await fetch('/api/list-images');
            const data = await response.json();
            imagePickerCache = data.images;
            return imagePickerCache;
        } catch (e) {
            console.error('Failed to fetch images:', e);
            return {};
        }
    }

    /**
     * Create the image picker dialog element (singleton)
     * @returns {HTMLElement} The backdrop element
     */
    function createImagePickerDialog() {
        if (imagePickerDialog) return imagePickerDialog;

        const backdrop = document.createElement('div');
        backdrop.className = 'image-picker-backdrop';
        backdrop.innerHTML = `
            <div class="image-picker-dialog">
                <div class="image-picker-header">Insert Image</div>
                <button type="button" class="image-picker-upload-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Upload from computer
                </button>
                <div class="image-picker-divider">or choose existing</div>
                <div class="image-picker-sessions"></div>
                <div class="image-picker-actions">
                    <button type="button" class="image-picker-cancel">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        imagePickerDialog = backdrop;
        return backdrop;
    }

    /**
     * Show image picker dialog
     * @param {number} insertAfterIndex
     * @param {Function} onSuccess - Called with (index, block) on success
     * @param {Function} showNotification
     */
    async function showImagePicker(insertAfterIndex, onSuccess, showNotification) {
        const dialog = createImagePickerDialog();
        const sessionsContainer = dialog.querySelector('.image-picker-sessions');
        const uploadBtn = dialog.querySelector('.image-picker-upload-btn');
        const cancelBtn = dialog.querySelector('.image-picker-cancel');

        // Show loading state
        sessionsContainer.innerHTML = '<div class="image-picker-loading">Loading images...</div>';
        dialog.classList.add('visible');

        // Fetch images
        const images = await fetchImageList();

        // Build sessions grid
        sessionsContainer.innerHTML = '';
        let totalImages = 0;

        for (const [sessionId, sessionImages] of Object.entries(images)) {
            if (sessionImages.length === 0) continue;
            totalImages += sessionImages.length;

            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'image-picker-session';

            const sessionNum = sessionId.replace('session-', '');
            sessionDiv.innerHTML = `<div class="image-picker-session-title">Session ${sessionNum}</div>`;

            const grid = document.createElement('div');
            grid.className = 'image-picker-grid';

            sessionImages.forEach(img => {
                const imgBtn = document.createElement('button');
                imgBtn.type = 'button';
                imgBtn.className = 'image-picker-thumb';
                imgBtn.dataset.path = img.path;
                imgBtn.title = img.date || '';
                imgBtn.innerHTML = `<img src="${img.path}" loading="lazy" alt="">`;
                grid.appendChild(imgBtn);
            });

            sessionDiv.appendChild(grid);
            sessionsContainer.appendChild(sessionDiv);
        }

        if (totalImages === 0) {
            sessionsContainer.innerHTML = '<div class="image-picker-empty">No existing images yet</div>';
        }

        // Handle selection
        return new Promise((resolve) => {
            const cleanup = () => {
                dialog.classList.remove('visible');
                dialog.removeEventListener('click', handleClick);
                document.removeEventListener('keydown', handleKeydown);
            };

            const handleClick = (e) => {
                // Thumbnail clicked
                const thumb = e.target.closest('.image-picker-thumb');
                if (thumb) {
                    const path = thumb.dataset.path;
                    cleanup();

                    // Create block with existing image
                    const block = EditBlocks.createBlock('image', {
                        src: path,
                        content: `![](${path})`
                    });
                    if (onSuccess) onSuccess(insertAfterIndex, block);
                    showNotification('Image inserted!');
                    resolve(path);
                    return;
                }

                // Upload button
                if (e.target.closest('.image-picker-upload-btn')) {
                    cleanup();
                    // Fall back to existing upload flow
                    showImageUploader(insertAfterIndex, onSuccess, showNotification);
                    resolve(null);
                    return;
                }

                // Cancel or backdrop click
                if (e.target === cancelBtn || e.target === dialog) {
                    cleanup();
                    resolve(null);
                }
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            };

            dialog.addEventListener('click', handleClick);
            document.addEventListener('keydown', handleKeydown);
        });
    }

    /**
     * Add a newly uploaded image to the picker cache
     * @param {string} path - The image path
     * @param {string} sessionId - The session ID
     */
    function addToImagePickerCache(path, sessionId) {
        if (!imagePickerCache) return;

        const date = new Date();
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (!imagePickerCache[sessionId]) {
            imagePickerCache[sessionId] = [];
        }

        // Add to beginning (newest first)
        imagePickerCache[sessionId].unshift({
            path: path,
            date: formattedDate
        });
    }

    // ========== VIDEO EMBED ==========

    /**
     * Prompt for video URL and create video block
     * @param {number} insertAfterIndex
     * @param {Function} onSuccess - Called with block data on success
     * @param {Function} showNotification
     */
    function addVideo(insertAfterIndex, onSuccess, showNotification) {
        const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
        if (!url) return;

        const embedUrl = EditUtils.convertToEmbedUrl(url);
        if (!embedUrl) {
            showNotification('Invalid video URL', true);
            return;
        }

        const block = EditBlocks.createBlock('video', {
            src: embedUrl,
            content: `!video(${embedUrl})`
        });

        if (onSuccess) {
            onSuccess(insertAfterIndex, block);
        }

        showNotification('Video added!');
    }

    // ========== MARKDOWN INSERTION HELPERS ==========

    /**
     * Upload image and return markdown string (for inserting into textareas)
     * @param {Function} onSuccess - Called with markdown string on success
     * @param {Function} showNotification
     */
    function uploadImageToMarkdown(onSuccess, showNotification) {
        showImagePicker(0, (_, block) => {
            if (onSuccess) onSuccess(block.content);
        }, showNotification);
    }

    /**
     * Prompt for video URL and return markdown string (for inserting into textareas)
     * @param {Function} onSuccess - Called with video markdown on success
     * @param {Function} showNotification
     */
    function addVideoToMarkdown(onSuccess, showNotification) {
        const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
        if (!url) return;

        const embedUrl = EditUtils.convertToEmbedUrl(url);
        if (!embedUrl) {
            showNotification('Invalid video URL', true);
            return;
        }

        const markdown = `!video(${embedUrl})`;
        if (onSuccess) onSuccess(markdown);
        showNotification('Video added!');
    }

    // ========== INITIALIZATION ==========

    /**
     * Initialize the media module
     * @param {Object} options
     * @param {string} options.sessionFile - Current session file name
     * @param {Function} options.onBlockUpdate - Called when block is updated
     */
    function init(options = {}) {
        sessionFile = options.sessionFile || '';
        onBlockUpdateCallback = options.onBlockUpdate || null;
        onBeforeChange = options.onBeforeChange || null;
        uploadedImages = [];

        // Add global listeners for handle position updates
        window.addEventListener('scroll', updateHandlePositions, true);
        window.addEventListener('resize', updateHandlePositions);
    }

    /**
     * Cleanup all media UI and listeners
     */
    function cleanup() {
        deselect();
        hideTextAlignmentToolbar();

        // Remove resize listeners (failsafe)
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        isResizing = false;

        // Remove global listeners
        window.removeEventListener('scroll', updateHandlePositions, true);
        window.removeEventListener('resize', updateHandlePositions);
    }

    /**
     * Get list of images uploaded this session
     * @returns {Array}
     */
    function getUploadedImages() {
        return uploadedImages;
    }

    /**
     * Clear uploaded images list (call after save)
     */
    function clearUploadedImages() {
        uploadedImages = [];
    }

    /**
     * Request cleanup of uploaded images (on cancel)
     * @returns {Promise}
     */
    async function cleanupUploadedImages() {
        if (uploadedImages.length === 0) return;

        try {
            await fetch('/api/cleanup-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: uploadedImages })
            });
        } catch (err) {
            console.warn('Cleanup failed:', err);
        }

        uploadedImages = [];
    }

    // ========== TEXT ALIGNMENT ==========

    let textAlignmentState = null; // { element, block, onUpdate }

    /**
     * Show alignment toolbar for text block
     * @param {HTMLElement} element - The textarea element
     * @param {Object} block - Block data object
     * @param {Function} onUpdate - Called when alignment changes
     */
    function showTextAlignmentToolbar(element, block, onUpdate) {
        textAlignmentState = { element, block, onUpdate };
        createAlignmentToolbar(element, block, setTextAlignment);
    }

    /**
     * Set alignment for text block
     * @param {string} align - 'left', 'center', or 'right'
     */
    function setTextAlignment(align) {
        if (!textAlignmentState) return;

        // Save state for undo before alignment changes
        if (onBeforeChange) onBeforeChange('text alignment');

        const { element, block, onUpdate } = textAlignmentState;

        // Update block data
        block.align = align;

        // Apply visual alignment to textarea
        EditUtils.applyTextAlignment(element, align);

        // Update toolbar active state
        if (alignmentToolbar) {
            alignmentToolbar.querySelectorAll('.align-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === align);
            });
        }

        // Notify update
        if (onUpdate) onUpdate();
    }

    /**
     * Hide text alignment toolbar
     */
    function hideTextAlignmentToolbar() {
        removeAlignmentToolbar();
        textAlignmentState = null;
    }

    // ========== PUBLIC API ==========

    return {
        // Initialization
        init,
        cleanup,

        // Selection
        select,
        deselect,
        getSelected,

        // Position updates
        updateHandlePositions,

        // Image upload & picker
        showImageUploader,
        showImagePicker,
        addToImagePickerCache,
        getUploadedImages,
        clearUploadedImages,
        cleanupUploadedImages,

        // Video embed
        addVideo,

        // Markdown insertion (for textareas)
        uploadImageToMarkdown,
        addVideoToMarkdown,

        // Text alignment
        showTextAlignmentToolbar,
        hideTextAlignmentToolbar,

        // State check
        isResizing: () => isResizing
    };
})();
