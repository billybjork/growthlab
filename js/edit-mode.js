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

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'edit-toolbar';
        toolbar.contentEditable = 'false'; // Prevent toolbar from being editable
        toolbar.innerHTML = `
            <button class="save-btn">💾 Save</button>
            <button class="add-image-btn">+ Add Image</button>
            <button class="cancel-btn">✕ Cancel</button>
        `;

        card.appendChild(toolbar);

        // Event listeners
        toolbar.querySelector('.save-btn').addEventListener('click', () => saveCard(cardIndex));
        toolbar.querySelector('.cancel-btn').addEventListener('click', () => cancelEdit(cardIndex));
        toolbar.querySelector('.add-image-btn').addEventListener('click', () => showImageUploader(cardIndex));

        // Focus the card
        card.focus();
    }

    function exitEditMode(cardIndex) {
        const card = STATE.cardElements[cardIndex];

        // Remove toolbar
        const toolbar = card.querySelector('.edit-toolbar');
        if (toolbar) toolbar.remove();

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

        // Remove the edit button and toolbar if present
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const editBtn = tempDiv.querySelector('.edit-card-btn');
        const toolbar = tempDiv.querySelector('.edit-toolbar');
        if (editBtn) editBtn.remove();
        if (toolbar) toolbar.remove();
        html = tempDiv.innerHTML;

        // Convert HTML tags to markdown
        markdown = html
            .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n')
            .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n')
            .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
            .replace(/<ul>(.*?)<\/ul>/gis, '$1')
            .replace(/<a href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)')
            .replace(/<img src="(.*?)" alt="(.*?)">/gi, '![$2]($1)')
            .replace(/<img src="(.*?)".*?>/gi, '![]($1)')
            .replace(/<div class="video-container">.*?src="(.*?)".*?<\/div>/gis, '!video($1)')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
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

        // Show loading state
        const toolbar = card.querySelector('.edit-toolbar');
        const addImageBtn = toolbar?.querySelector('.add-image-btn');
        const originalText = addImageBtn?.textContent;
        if (addImageBtn) addImageBtn.textContent = '⏳ Uploading...';

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

            // Insert image into card content at the end
            const imageMarkdown = `\n\n![](${result.path})`;

            // Insert at cursor position or at the end
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const imageNode = document.createTextNode(imageMarkdown);
                range.insertNode(imageNode);
            } else {
                // Append to end
                const imgElement = document.createElement('img');
                imgElement.src = result.path;
                imgElement.alt = '';
                card.insertBefore(imgElement, toolbar);
            }

            showNotification('Image uploaded successfully!');

        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Upload error: ${error.message}`, true);
        } finally {
            // Restore button text
            if (addImageBtn) addImageBtn.textContent = originalText;
        }
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
