/**
 * Edit Mode Module for GrowthLab Viewer
 * Handles in-place card editing, saving, and image uploads
 */

function initEditMode(STATE, { parseMarkdown, isDevMode }) {
    if (!isDevMode) return;

    // ========== NOTIFICATION SYSTEM ==========

    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `edit-notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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
        document.body.appendChild(plusBtn);
        inlinePlusButton = plusBtn;

        // Create popup menu
        const menu = document.createElement('div');
        menu.className = 'inline-plus-menu';
        menu.contentEditable = 'false';
        menu.style.display = 'none';
        menu.innerHTML = `
            <button class="inline-menu-btn image-btn">📷 Image</button>
            <button class="inline-menu-btn video-btn">🎥 Video</button>
        `;
        document.body.appendChild(menu);
        inlineMenu = menu;

        // Show menu on + button hover
        plusBtn.addEventListener('mouseenter', () => {
            menu.style.display = 'flex';
        });

        // Hide menu when mouse leaves both button and menu
        const hideMenu = () => {
            setTimeout(() => {
                if (!plusBtn.matches(':hover') && !menu.matches(':hover')) {
                    menu.style.display = 'none';
                }
            }, 100);
        };

        plusBtn.addEventListener('mouseleave', hideMenu);
        menu.addEventListener('mouseleave', hideMenu);

        // Add click handlers for menu items
        menu.querySelector('.image-btn').addEventListener('click', () => {
            menu.style.display = 'none';
            showImageUploader(STATE.editingCardIndex);
        });

        menu.querySelector('.video-btn').addEventListener('click', () => {
            menu.style.display = 'none';
            addVideo(STATE.editingCardIndex);
        });
    }

    function positionInlinePlusButton(targetElement) {
        if (!inlinePlusButton || !targetElement) return;

        insertionTarget = targetElement;

        const rect = targetElement.getBoundingClientRect();
        const cardRect = targetElement.closest('.card').getBoundingClientRect();

        // Position on the right edge of the element
        inlinePlusButton.style.top = `${rect.top + rect.height / 2 - 12}px`; // 12 = half of button height
        inlinePlusButton.style.left = `${cardRect.right - 40}px`; // 40px from right edge
        inlinePlusButton.style.display = 'flex';

        // Position menu to the left of the button
        const buttonRect = inlinePlusButton.getBoundingClientRect();
        inlineMenu.style.top = `${buttonRect.top}px`;
        inlineMenu.style.left = `${buttonRect.left - inlineMenu.offsetWidth - 8}px`;
    }

    function hideInlinePlusButton() {
        if (inlinePlusButton) {
            setTimeout(() => {
                if (!inlinePlusButton.matches(':hover') && !inlineMenu.matches(':hover')) {
                    inlinePlusButton.style.display = 'none';
                    inlineMenu.style.display = 'none';
                    insertionTarget = null;
                }
            }, 100);
        }
    }

    function setupInlineButtonTracking(card) {
        // Track mouse position over editable content elements
        const trackableElements = 'h1, h2, p, li, img, .video-container';

        card.addEventListener('mouseover', (e) => {
            // Only show button if card is still in editing mode
            if (!card.classList.contains('editing')) return;

            const target = e.target.closest(trackableElements);
            if (target && card.contains(target)) {
                positionInlinePlusButton(target);
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

        // Focus the card
        card.focus();
    }

    function exitEditMode(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Hide global toolbar
        if (globalToolbar) {
            globalToolbar.style.display = 'none';
        }

        // Hide inline plus button and menu
        if (inlinePlusButton) {
            inlinePlusButton.style.display = 'none';
        }
        if (inlineMenu) {
            inlineMenu.style.display = 'none';
        }

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
        html = tempDiv.innerHTML;

        // Convert HTML tags to markdown
        markdown = html
            .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
            .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul>(.*?)<\/ul>/gis, '$1')
            .replace(/<a href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)')
            // Add proper spacing around images and videos
            .replace(/<img src="(.*?)" alt="(.*?)">/gi, '\n\n![$2]($1)\n\n')
            .replace(/<img src="(.*?)".*?>/gi, '\n\n![]($1)\n\n')
            .replace(/<div class="video-container">.*?src="(.*?)".*?<\/div>/gis, '\n\n!video($1)\n\n')
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

            // Insert at tracked position or end of card
            if (insertionTarget) {
                insertElementAfter(document.createElement('br'), insertionTarget);
                insertElementAfter(imgElement, insertionTarget.nextSibling);
                insertElementAfter(document.createElement('br'), imgElement);
            } else {
                insertElementAtEnd(document.createElement('br'));
                insertElementAtEnd(imgElement);
                insertElementAtEnd(document.createElement('br'));
            }

            showNotification('Image added! Click Save when done.');

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload error: ${error.message}`, true);
        }
    }

    // ========== VIDEO EMBED ==========

    function convertToEmbedUrl(url) {
        // YouTube: convert watch URLs to embed URLs
        if (url.includes('youtube.com/watch')) {
            const videoId = new URL(url).searchParams.get('v');
            if (videoId) {
                return `https://www.youtube.com/embed/${videoId}`;
            }
        }

        // YouTube short URLs
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1].split('?')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }

        // Vimeo: convert to embed URLs
        if (url.includes('vimeo.com/') && !url.includes('/video/')) {
            const videoId = url.split('vimeo.com/')[1].split('?')[0];
            return `https://player.vimeo.com/video/${videoId}`;
        }

        // If already an embed URL or unknown format, return as-is
        return url;
    }

    function addVideo(cardIndex) {
        const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
        if (!url) return;

        // Convert to embed URL if needed
        const embedUrl = convertToEmbedUrl(url);

        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

        // Insert at tracked position or end of card
        if (insertionTarget) {
            insertElementAfter(document.createElement('br'), insertionTarget);
            insertElementAfter(videoContainer, insertionTarget.nextSibling);
            insertElementAfter(document.createElement('br'), videoContainer);
        } else {
            insertElementAtEnd(document.createElement('br'));
            insertElementAtEnd(videoContainer);
            insertElementAtEnd(document.createElement('br'));
        }

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

    // ========== KEYBOARD SHORTCUTS ==========

    function setupEditModeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Edit mode shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                if (STATE.editingCardIndex === -1) {
                    enterEditMode(STATE.currentIndex);
                }
            }

            // Save shortcut
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && STATE.editingCardIndex !== -1) {
                e.preventDefault();
                saveCard(STATE.editingCardIndex);
            }

            // Cancel with Escape
            if (e.key === 'Escape' && STATE.editingCardIndex !== -1) {
                e.preventDefault();
                cancelEdit(STATE.editingCardIndex);
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
