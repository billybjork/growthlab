/**
 * Edit Mode Module for GrowthLab Viewer
 * Handles in-place card editing, saving, and image uploads
 */

function initEditMode(STATE, { parseMarkdown, isDevMode }) {
    if (!isDevMode) return;

    // ========== CONSTANTS ==========

    const INLINE_BUTTON_CONFIG = {
        HALF_HEIGHT: 12,              // Half of button height for centering
        RIGHT_MARGIN: 40,              // Distance from right edge of card
        MENU_SPACING: 8,               // Gap between button and menu
        HOVER_DELAY_MS: 100            // Delay before hiding on mouse leave
    };

    const NOTIFICATION_CONFIG = {
        FADE_IN_DELAY_MS: 10,          // Small delay for CSS transition
        DISPLAY_DURATION_MS: 3000,     // How long to show notification
        FADE_OUT_DURATION_MS: 300      // Fade out animation time
    };

    // ========== NOTIFICATION SYSTEM ==========

    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `edit-notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, NOTIFICATION_CONFIG.FADE_IN_DELAY_MS);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), NOTIFICATION_CONFIG.FADE_OUT_DURATION_MS);
        }, NOTIFICATION_CONFIG.DISPLAY_DURATION_MS);
    }

    // ========== EDIT BUTTON ==========

    function addEditButtonToCard(card, cardIndex) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-card-btn';
        editBtn.innerHTML = '✎ Edit';
        editBtn.contentEditable = 'false'; // Prevent button from being editable
        editBtn.setAttribute('data-card-index', cardIndex);
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            enterEditMode(cardIndex);
        });

        card.appendChild(editBtn);
    }

    // ========== EDIT MODE MANAGEMENT ==========

    // Create a single global toolbar that lives outside the card
    let globalToolbar = null;
    let inlinePlusButton = null;
    let inlineMenu = null;
    let insertionTarget = null;

    function createGlobalToolbar() {
        if (globalToolbar) return globalToolbar;

        const toolbar = document.createElement('div');
        toolbar.className = 'edit-toolbar';
        toolbar.style.display = 'none'; // Hidden by default
        toolbar.innerHTML = `
            <button class="save-btn">💾 Save</button>
            <button class="cancel-btn">✕ Cancel</button>
        `;

        document.body.appendChild(toolbar);
        globalToolbar = toolbar;
        return toolbar;
    }

    function createInlinePlusButton() {
        if (inlinePlusButton) return;

        // Create + button
        const plusBtn = document.createElement('button');
        plusBtn.className = 'inline-plus-btn';
        plusBtn.innerHTML = '+';
        plusBtn.contentEditable = 'false';
        plusBtn.style.display = 'none';
        plusBtn.setAttribute('aria-label', 'Insert media');
        plusBtn.setAttribute('aria-haspopup', 'menu');
        plusBtn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(plusBtn);
        inlinePlusButton = plusBtn;

        // Create popup menu
        const menu = document.createElement('div');
        menu.className = 'inline-plus-menu';
        menu.contentEditable = 'false';
        // Don't set display: none here - let CSS handle visibility via opacity/pointer-events
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Media insertion menu');
        menu.innerHTML = `
            <button class="inline-menu-btn image-btn" role="menuitem">📷 Image</button>
            <button class="inline-menu-btn video-btn" role="menuitem">🎥 Video</button>
        `;
        document.body.appendChild(menu);
        inlineMenu = menu;

        // Show menu and highlight line on + button hover
        plusBtn.addEventListener('mouseenter', () => {
            menu.classList.add('visible');
            plusBtn.setAttribute('aria-expanded', 'true');
            // Highlight the insertion target line
            if (insertionTarget) {
                insertionTarget.classList.add('insertion-highlight');
            }
        });

        // Hide menu and remove highlight when mouse leaves both button and menu
        const hideMenu = () => {
            setTimeout(() => {
                if (!plusBtn.matches(':hover') && !menu.matches(':hover')) {
                    menu.classList.remove('visible');
                    plusBtn.setAttribute('aria-expanded', 'false');
                    // Remove highlight from insertion target
                    if (insertionTarget) {
                        insertionTarget.classList.remove('insertion-highlight');
                    }
                }
            }, INLINE_BUTTON_CONFIG.HOVER_DELAY_MS);
        };

        plusBtn.addEventListener('mouseleave', hideMenu);
        menu.addEventListener('mouseleave', hideMenu);

        // Add click handlers for menu items
        menu.querySelector('.image-btn').addEventListener('click', () => {
            menu.classList.remove('visible');
            plusBtn.setAttribute('aria-expanded', 'false');
            showImageUploader(STATE.editingCardIndex);
        });

        menu.querySelector('.video-btn').addEventListener('click', () => {
            menu.classList.remove('visible');
            plusBtn.setAttribute('aria-expanded', 'false');
            addVideo(STATE.editingCardIndex);
        });
    }

    function positionInlinePlusButton(targetElement) {
        if (!inlinePlusButton || !targetElement) return;

        // Remove highlight from previous target if switching to a new one
        if (insertionTarget && insertionTarget !== targetElement) {
            insertionTarget.classList.remove('insertion-highlight');
        }

        insertionTarget = targetElement;

        const rect = targetElement.getBoundingClientRect();
        const cardRect = targetElement.closest('.card').getBoundingClientRect();

        // Position on the right edge of the element
        inlinePlusButton.style.top = `${rect.top + rect.height / 2 - INLINE_BUTTON_CONFIG.HALF_HEIGHT}px`;
        inlinePlusButton.style.left = `${cardRect.right - INLINE_BUTTON_CONFIG.RIGHT_MARGIN}px`;
        inlinePlusButton.style.display = 'flex';

        // Position menu to the left of the button
        const buttonRect = inlinePlusButton.getBoundingClientRect();
        inlineMenu.style.top = `${buttonRect.top}px`;
        inlineMenu.style.left = `${buttonRect.left - inlineMenu.offsetWidth - INLINE_BUTTON_CONFIG.MENU_SPACING}px`;
    }

    function hideInlinePlusButton() {
        if (inlinePlusButton) {
            setTimeout(() => {
                if (!inlinePlusButton.matches(':hover') && !inlineMenu.matches(':hover')) {
                    inlinePlusButton.style.display = 'none';
                    inlinePlusButton.setAttribute('aria-expanded', 'false');
                    inlineMenu.classList.remove('visible');
                    // Remove highlight from insertion target
                    if (insertionTarget) {
                        insertionTarget.classList.remove('insertion-highlight');
                    }
                    insertionTarget = null;
                }
            }, INLINE_BUTTON_CONFIG.HOVER_DELAY_MS);
        }
    }

    function setupInlineButtonTracking(card) {
        // Track mouse position over editable content elements
        const trackableElements = 'h1, h2, h3, h4, h5, h6, p, li, img, .video-container';
        const contentEditableDivs = 'div:not([class])'; // divs without classes (likely from contentEditable)

        card.addEventListener('mouseover', (e) => {
            // Only show button if card is still in editing mode
            if (!card.classList.contains('editing')) return;

            // Don't change insertion target if user is interacting with the menu
            if (inlinePlusButton && (inlinePlusButton.matches(':hover') || inlineMenu.matches(':hover'))) {
                return;
            }

            // Try to find a specific element first (h1, p, li, etc.)
            let target = e.target.matches(trackableElements) ? e.target : e.target.closest(trackableElements);

            // If no specific element found, check for contentEditable-created divs
            if (!target) {
                target = e.target.matches(contentEditableDivs) ? e.target : e.target.closest(contentEditableDivs);
            }

            // Only use elements that don't contain other block-level children
            // This prevents selecting parent divs when we want the specific line
            if (target && card.contains(target) && target !== card) {
                const blockChildren = target.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, li');
                // If this element contains other block elements, it's probably a container - don't use it
                if (blockChildren.length === 0) {
                    positionInlinePlusButton(target);
                }
            }
        });

        card.addEventListener('mouseleave', () => {
            hideInlinePlusButton();
        });
    }

    function enterEditMode(cardIndex) {
        if (STATE.editingCardIndex !== -1) {
            showNotification('Please save or cancel current edits first', true);
            return;
        }

        const card = STATE.cardElements[cardIndex];
        STATE.editingCardIndex = cardIndex;
        STATE.originalCardContent = STATE.cards[cardIndex];

        // Update query params to include editing state
        const params = new URLSearchParams(window.location.search);
        params.set('editing', 'true');
        window.history.replaceState(null, '', '?' + params.toString());

        // Hide edit button
        const editBtn = card.querySelector('.edit-card-btn');
        if (editBtn) editBtn.style.display = 'none';

        // Make card editable
        card.classList.add('editing');
        card.contentEditable = 'true';

        // Enable text selection and disable drag interactions
        card.style.userSelect = 'text';
        card.style.touchAction = 'auto';

        // Show global toolbar
        const toolbar = createGlobalToolbar();
        toolbar.style.display = 'flex';

        // Remove old event listeners by cloning (prevents duplicates)
        const newToolbar = toolbar.cloneNode(true);
        toolbar.parentNode.replaceChild(newToolbar, toolbar);
        globalToolbar = newToolbar;
        newToolbar.style.display = 'flex';

        // Event listeners
        newToolbar.querySelector('.save-btn').addEventListener('click', () => saveCard(cardIndex));
        newToolbar.querySelector('.cancel-btn').addEventListener('click', () => cancelEdit(cardIndex));

        // Create and setup inline plus button
        createInlinePlusButton();
        setupInlineButtonTracking(card);

        // Setup media resizing
        setupMediaResizing(card);

        // Focus the card
        card.focus();
    }

    function exitEditMode(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Remove editing param from query string
        const params = new URLSearchParams(window.location.search);
        params.delete('editing');
        window.history.replaceState(null, '', '?' + params.toString());

        // Hide global toolbar
        if (globalToolbar) {
            globalToolbar.style.display = 'none';
        }

        // Hide inline plus button and menu
        if (inlinePlusButton) {
            inlinePlusButton.style.display = 'none';
            inlinePlusButton.setAttribute('aria-expanded', 'false');
        }
        if (inlineMenu) {
            inlineMenu.classList.remove('visible');
        }

        // Remove highlight from insertion target
        if (insertionTarget) {
            insertionTarget.classList.remove('insertion-highlight');
        }

        // Deselect any media and remove resize handles
        deselectMediaElement();

        // Make card non-editable
        card.classList.remove('editing');
        card.contentEditable = 'false';

        // Restore drag interactions
        card.style.userSelect = '';
        card.style.touchAction = '';

        // Show edit button
        const editBtn = card.querySelector('.edit-card-btn');
        if (editBtn) editBtn.style.display = '';

        STATE.editingCardIndex = -1;
        STATE.originalCardContent = null;
        insertionTarget = null;
    }

    function cancelEdit(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Restore original content
        card.innerHTML = parseMarkdown(STATE.originalCardContent);

        // Re-add edit button
        addEditButtonToCard(card, cardIndex);

        exitEditMode(cardIndex);
        showNotification('Changes discarded');
    }

    // ========== MARKDOWN CONVERSION ==========

    function convertHtmlToMarkdown(html) {
        // Simple HTML to Markdown conversion
        let markdown = html;

        // Remove the edit button if present (toolbar is now outside card DOM)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const editBtn = tempDiv.querySelector('.edit-card-btn');
        if (editBtn) editBtn.remove();

        // Remove media-selected class from any elements (don't save selection state)
        tempDiv.querySelectorAll('.media-selected').forEach(el => {
            el.classList.remove('media-selected');
        });

        html = tempDiv.innerHTML;

        // Convert HTML tags to markdown
        markdown = html
            // First, convert div elements to paragraphs (contentEditable creates divs)
            // BUT preserve video-container divs (we'll handle them separately)
            .replace(/<div(?![^>]*class="video-container")[^>]*>(.*?)<\/div>/gi, '<p>$1</p>')
            // Handle empty divs (not video containers)
            .replace(/<div(?![^>]*class="video-container")[^>]*><\/div>/gi, '<br>')
            .replace(/<div(?![^>]*class="video-container")[^>]*>\s*<\/div>/gi, '<br>')
            // Now convert standard elements (handle attributes with [^>]*)
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
            .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
            .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            // Handle empty paragraphs
            .replace(/<p[^>]*><\/p>/gi, '\n')
            .replace(/<p[^>]*>\s*<\/p>/gi, '\n')
            .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1')
            .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1')
            .replace(/<a href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)');

        // Handle images - preserve style attribute if present, otherwise convert to markdown
        markdown = markdown.replace(/<img([^>]*)>/gi, (match, attributes) => {
            // Extract src, alt, and style attributes
            const srcMatch = attributes.match(/src="([^"]*)"/i);
            const altMatch = attributes.match(/alt="([^"]*)"/i);
            const styleMatch = attributes.match(/style="([^"]*)"/i);

            const src = srcMatch ? srcMatch[1] : '';
            const alt = altMatch ? altMatch[1] : '';
            const style = styleMatch ? styleMatch[1] : '';

            // If there's a style attribute, preserve the full HTML
            if (style) {
                return `\n\n<img src="${src}" alt="${alt}" style="${style}">\n\n`;
            } else {
                // Otherwise use markdown syntax
                return `\n\n![${alt}](${src})\n\n`;
            }
        });

        // Handle video containers - preserve style if present, otherwise use custom syntax
        markdown = markdown.replace(/<div class="video-container"([^>]*)>.*?<iframe[^>]*src="([^"]*)"[^>]*>.*?<\/iframe>.*?<\/div>/gis, (match, divAttributes, iframeSrc) => {
            const styleMatch = divAttributes.match(/style="([^"]*)"/i);
            const style = styleMatch ? styleMatch[1] : '';

            // If there's a style attribute, preserve the full HTML
            if (style) {
                // Reconstruct the video-container with style
                return `\n\n<div class="video-container" style="${style}"><iframe src="${iframeSrc}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n\n`;
            } else {
                // Otherwise use custom video syntax
                return `\n\n!video(${iframeSrc})\n\n`;
            }
        });

        // Continue with other conversions
        markdown = markdown
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            // Clean up excessive newlines (max 2 consecutive)
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return markdown;
    }

    // ========== SAVE FUNCTIONALITY ==========

    async function saveCard(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Extract content and convert to markdown
        const htmlContent = card.innerHTML;
        const markdownContent = convertHtmlToMarkdown(htmlContent);

        try {
            // Send update to server
            const response = await fetch('/api/update-card', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionFile: STATE.sessionFile,
                    cardIndex: cardIndex,
                    content: markdownContent,
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

            exitEditMode(cardIndex);
            showNotification('Card saved successfully!');

        } catch (error) {
            console.error('Save error:', error);
            showNotification(`Error: ${error.message}`, true);
        }
    }

    // ========== IMAGE UPLOAD ==========

    function showImageUploader(cardIndex) {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            await uploadImage(file, cardIndex);
        });

        fileInput.click();
    }

    async function uploadImage(file, cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Show loading notification
        showNotification('Uploading image...');

        try {
            // Create form data
            const formData = new FormData();
            formData.append('image', file);
            formData.append('sessionId', STATE.sessionFile);

            // Upload to server
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }

            // Create image element
            const imgElement = document.createElement('img');
            imgElement.src = result.path;
            imgElement.alt = '';

            // Insert with spacing
            insertElementWithSpacing(imgElement);

            // Clean up highlight, hide button/menu, and reset state
            if (insertionTarget) {
                insertionTarget.classList.remove('insertion-highlight');
            }
            if (inlinePlusButton) {
                inlinePlusButton.style.display = 'none';
                inlinePlusButton.setAttribute('aria-expanded', 'false');
            }
            if (inlineMenu) {
                inlineMenu.classList.remove('visible');
            }
            insertionTarget = null;

            showNotification('Image added! Click Save when done.');

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload error: ${error.message}`, true);
        }
    }

    // ========== VIDEO EMBED ==========

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function convertToEmbedUrl(url) {
        // Validate URL first
        if (!isValidUrl(url)) {
            return null;
        }

        // YouTube: convert watch URLs to embed URLs
        if (url.includes('youtube.com/watch')) {
            try {
                const videoId = new URL(url).searchParams.get('v');
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
            } catch (e) {
                return null;
            }
        }

        // YouTube short URLs
        if (url.includes('youtu.be/')) {
            try {
                const videoId = url.split('youtu.be/')[1].split('?')[0];
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}`;
                }
            } catch (e) {
                return null;
            }
        }

        // Vimeo: convert to embed URLs
        if (url.includes('vimeo.com/') && !url.includes('/video/')) {
            try {
                const videoId = url.split('vimeo.com/')[1].split('?')[0];
                if (videoId) {
                    return `https://player.vimeo.com/video/${videoId}`;
                }
            } catch (e) {
                return null;
            }
        }

        // If already an embed URL or unknown format, return as-is
        return url;
    }

    function addVideo(cardIndex) {
        const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
        if (!url) return;

        // Convert to embed URL if needed
        const embedUrl = convertToEmbedUrl(url);

        // Validate the URL
        if (!embedUrl) {
            showNotification('Invalid video URL. Please enter a valid YouTube or Vimeo URL.', true);
            return;
        }

        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

        // Insert with spacing
        insertElementWithSpacing(videoContainer);

        // Clean up highlight, hide button/menu, and reset state
        if (insertionTarget) {
            insertionTarget.classList.remove('insertion-highlight');
        }
        if (inlinePlusButton) {
            inlinePlusButton.style.display = 'none';
            inlinePlusButton.setAttribute('aria-expanded', 'false');
        }
        if (inlineMenu) {
            inlineMenu.classList.remove('visible');
        }
        insertionTarget = null;

        showNotification('Video added! Click Save when done.');
    }

    // ========== INSERTION HELPERS ==========

    function insertElementAtEnd(element) {
        const card = document.querySelector('.card.editing');
        if (!card) return;

        // Since toolbar is no longer a child of the card, just append
        card.appendChild(element);
    }

    function insertElementAfter(newElement, targetElement) {
        if (!targetElement || !targetElement.parentNode) {
            insertElementAtEnd(newElement);
            return;
        }

        targetElement.parentNode.insertBefore(newElement, targetElement.nextSibling);
    }

    function insertElementWithSpacing(element) {
        // Insert element with spacing (br tags) at the tracked insertion point or end of card
        if (insertionTarget) {
            insertElementAfter(document.createElement('br'), insertionTarget);
            insertElementAfter(element, insertionTarget.nextSibling);
            insertElementAfter(document.createElement('br'), element);
        } else {
            insertElementAtEnd(document.createElement('br'));
            insertElementAtEnd(element);
            insertElementAtEnd(document.createElement('br'));
        }
    }

    // ========== KEYBOARD SHORTCUTS ==========

    /**
     * Wraps the currently selected text with markdown syntax
     * @param {string} before - Text to insert before selection
     * @param {string} after - Text to insert after selection
     * @param {string} placeholder - Text to use if nothing is selected
     */
    function wrapSelection(before, after, placeholder = '') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString() || placeholder;

        // Create the wrapped text
        const wrappedText = before + selectedText + after;

        // Delete the current selection and insert the wrapped text
        range.deleteContents();
        const textNode = document.createTextNode(wrappedText);
        range.insertNode(textNode);

        // Set cursor position after the wrapped text if there was a selection,
        // or between the markers if it was empty
        const newRange = document.createRange();
        if (selectedText === placeholder) {
            // Position cursor between the markers
            newRange.setStart(textNode, before.length);
            newRange.setEnd(textNode, before.length + placeholder.length);
        } else {
            // Position cursor after the wrapped text
            newRange.setStartAfter(textNode);
            newRange.setEndAfter(textNode);
        }

        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    /**
     * Creates a markdown link from selected text
     */
    function insertLink() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString() || 'link text';

        // Prompt for URL
        const url = prompt('Enter URL:');
        if (!url) return; // User cancelled

        // Create the markdown link
        const linkText = `[${selectedText}](${url})`;

        // Delete the current selection and insert the link
        range.deleteContents();
        const textNode = document.createTextNode(linkText);
        range.insertNode(textNode);

        // Position cursor after the link
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);

        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    function setupEditModeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only apply formatting shortcuts when in edit mode
            const isInEditMode = STATE.editingCardIndex !== -1;

            // Edit mode shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                if (STATE.editingCardIndex === -1) {
                    enterEditMode(STATE.currentIndex);
                }
            }

            // Save shortcut
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && isInEditMode) {
                e.preventDefault();
                saveCard(STATE.editingCardIndex);
            }

            // Cancel with Escape
            if (e.key === 'Escape' && isInEditMode) {
                e.preventDefault();
                cancelEdit(STATE.editingCardIndex);
            }

            // Delete selected media (Delete or Backspace key)
            if (isInEditMode && selectedMedia && (e.key === 'Delete' || e.key === 'Backspace')) {
                e.preventDefault();
                deleteSelectedMedia();
            }

            // Formatting shortcuts (only in edit mode)
            if (isInEditMode) {
                // Bold (Command+B)
                if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                    e.preventDefault();
                    wrapSelection('**', '**', 'bold text');
                }

                // Italic (Command+I)
                if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                    e.preventDefault();
                    wrapSelection('*', '*', 'italic text');
                }

                // Link (Command+K)
                if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                    e.preventDefault();
                    insertLink();
                }
            }
        });
    }

    // ========== MEDIA RESIZE FUNCTIONALITY ==========

    let selectedMedia = null;
    let resizeHandles = [];
    let resizeTooltip = null;
    let isResizing = false;
    let resizeState = {};

    const RESIZE_CONFIG = {
        MIN_WIDTH_PERCENT: 20,
        MAX_WIDTH_PERCENT: 100,
        HANDLE_POSITIONS: ['nw', 'ne', 'sw', 'se']
    };

    function setupMediaResizing(card) {
        // Add click handlers to images and videos
        card.addEventListener('click', (e) => {
            // Only allow selection in edit mode
            if (!card.classList.contains('editing')) return;

            // Check if clicking on an image or video container
            const img = e.target.tagName === 'IMG' ? e.target : null;
            const videoContainer = e.target.closest('.video-container');

            if (img || videoContainer) {
                e.stopPropagation();
                selectMediaElement(img || videoContainer);
            } else if (!e.target.closest('.resize-handle')) {
                // Clicked elsewhere in card (not on handle), deselect
                deselectMediaElement();
            }
        });
    }

    function selectMediaElement(element) {
        // Don't reselect the same element
        if (selectedMedia === element) return;

        // Deselect previous
        deselectMediaElement();

        // Mark as selected
        selectedMedia = element;
        element.classList.add('media-selected');

        // Create resize handles
        createResizeHandles(element);
    }

    function deselectMediaElement() {
        if (!selectedMedia) return;

        // Remove selection class
        selectedMedia.classList.remove('media-selected');

        // Remove resize handles
        removeResizeHandles();

        selectedMedia = null;
    }

    function deleteSelectedMedia() {
        if (!selectedMedia) return;

        // Remove any surrounding br tags for cleaner markdown
        const prevSibling = selectedMedia.previousSibling;
        const nextSibling = selectedMedia.nextSibling;

        // Remove the element
        selectedMedia.remove();

        // Clean up surrounding br tags if they exist
        if (prevSibling && prevSibling.nodeName === 'BR') {
            prevSibling.remove();
        }
        if (nextSibling && nextSibling.nodeName === 'BR') {
            nextSibling.remove();
        }

        // Remove resize handles
        removeResizeHandles();

        selectedMedia = null;
    }

    function createResizeHandles(element) {
        const rect = element.getBoundingClientRect();

        RESIZE_CONFIG.HANDLE_POSITIONS.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.contentEditable = 'false';
            handle.setAttribute('data-position', position);

            // Position the handle
            positionHandle(handle, position, rect);

            // Add drag handlers
            handle.addEventListener('mousedown', (e) => startResize(e, position, element));

            document.body.appendChild(handle);
            resizeHandles.push(handle);
        });
    }

    function positionHandle(handle, position, rect) {
        // Position is fixed relative to viewport
        handle.style.position = 'fixed';

        switch (position) {
            case 'nw':
                handle.style.top = `${rect.top - 6}px`;
                handle.style.left = `${rect.left - 6}px`;
                break;
            case 'ne':
                handle.style.top = `${rect.top - 6}px`;
                handle.style.left = `${rect.right - 6}px`;
                break;
            case 'sw':
                handle.style.top = `${rect.bottom - 6}px`;
                handle.style.left = `${rect.left - 6}px`;
                break;
            case 'se':
                handle.style.top = `${rect.bottom - 6}px`;
                handle.style.left = `${rect.right - 6}px`;
                break;
        }
    }

    function updateHandlePositions() {
        if (!selectedMedia || resizeHandles.length === 0) return;

        const rect = selectedMedia.getBoundingClientRect();

        resizeHandles.forEach(handle => {
            const position = handle.getAttribute('data-position');
            positionHandle(handle, position, rect);
        });
    }

    function removeResizeHandles() {
        resizeHandles.forEach(handle => handle.remove());
        resizeHandles = [];
    }

    function startResize(e, position, element) {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;

        // Store initial state
        const rect = element.getBoundingClientRect();
        const card = element.closest('.card');
        const cardRect = card.getBoundingClientRect();

        resizeState = {
            element,
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

        // Create tooltip
        createResizeTooltip();

        // Add global mouse handlers
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    }

    function handleResize(e) {
        if (!isResizing) return;

        const { element, position, startX, startY, startWidth, startHeight, aspectRatio, minWidth, maxWidth } = resizeState;

        // Calculate delta based on handle position
        let deltaX = 0;
        let deltaY = 0;

        switch (position) {
            case 'se': // Southeast (bottom-right)
                deltaX = e.clientX - startX;
                deltaY = e.clientY - startY;
                break;
            case 'sw': // Southwest (bottom-left)
                deltaX = -(e.clientX - startX);
                deltaY = e.clientY - startY;
                break;
            case 'ne': // Northeast (top-right)
                deltaX = e.clientX - startX;
                deltaY = -(e.clientY - startY);
                break;
            case 'nw': // Northwest (top-left)
                deltaX = -(e.clientX - startX);
                deltaY = -(e.clientY - startY);
                break;
        }

        // Use the larger delta to maintain aspect ratio
        const avgDelta = (deltaX + deltaY) / 2;
        let newWidth = startWidth + avgDelta;

        // Apply constraints
        newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Calculate new height based on aspect ratio
        const newHeight = newWidth / aspectRatio;

        // Apply new size
        if (element.tagName === 'IMG') {
            element.style.maxWidth = `${newWidth}px`;
            element.style.width = `${newWidth}px`;
            element.style.height = 'auto'; // Maintain aspect ratio
        } else if (element.classList.contains('video-container')) {
            element.style.maxWidth = `${newWidth}px`;
            element.style.width = `${newWidth}px`;
        }

        // Update handle positions
        updateHandlePositions();

        // Update tooltip
        updateResizeTooltip(e.clientX, e.clientY, newWidth, newHeight);
    }

    function stopResize() {
        if (!isResizing) return;

        isResizing = false;

        // Remove global handlers
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);

        // Restore text selection
        document.body.style.userSelect = '';

        // Remove tooltip
        removeResizeTooltip();

        // Clear state
        resizeState = {};
    }

    function createResizeTooltip() {
        if (resizeTooltip) return;

        resizeTooltip = document.createElement('div');
        resizeTooltip.className = 'resize-tooltip';
        document.body.appendChild(resizeTooltip);
    }

    function updateResizeTooltip(x, y, width, height) {
        if (!resizeTooltip) return;

        resizeTooltip.textContent = `${Math.round(width)} × ${Math.round(height)}`;
        resizeTooltip.style.left = `${x + 15}px`;
        resizeTooltip.style.top = `${y + 15}px`;
    }

    function removeResizeTooltip() {
        if (resizeTooltip) {
            resizeTooltip.remove();
            resizeTooltip = null;
        }
    }

    // Update handle positions on scroll or resize
    window.addEventListener('scroll', updateHandlePositions, true);
    window.addEventListener('resize', updateHandlePositions);

    // ========== PUBLIC API ==========

    return {
        addEditButtonToCard,
        enterEditMode,
        setupEditModeKeyboardShortcuts,
    };
}

// Make available globally
window.initEditMode = initEditMode;
