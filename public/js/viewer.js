document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        cards: [],
        cardElements: [],
        currentIndex: 0,
        isAnimating: false,
        editingCardIndex: -1,  // Used by edit-mode.js
    };

    // Edit mode detection
    const isDevMode =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        new URLSearchParams(window.location.search).get('edit') === 'true';

    const UI = {
        cardStack: document.getElementById('card-stack'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        progressBar: document.getElementById('progress-bar'),
    };

    const CONFIG = {
        VISIBLE_CARDS: 4,
        SCALE_FACTOR: 0.05,
        TRANSLATE_FACTOR: 12,
        CARD_ANGLES: [0, 1.5, -1.5, 1.5],
        TRANSITION_DURATION: 450,
        STACK_UPDATE_DELAY: 100,
        THROW_DISTANCE: '-150%',
        THROW_ROTATION: '-10deg',
        TRANSITION_CSS: 'transform 450ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 450ms ease, z-index 0s',
    };

    function applyHiddenCardStyles(card) {
        card.style.opacity = '0';
        card.style.zIndex = 0;
        card.style.pointerEvents = 'none';
        card.style.transform = 'scale(0.8) translateY(-40px)';
    }

    /**
     * Reset all inline styles applied to a card
     * @param {HTMLElement} card - Card element to reset
     */
    function resetCardInlineStyles(card) {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.zIndex = '';
        card.style.pointerEvents = '';
        card.style.transition = '';
    }

    /**
     * Validate URL to only allow safe protocols
     * @param {string} url - URL to validate
     * @returns {boolean} - True if URL is safe
     */
    function isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Parse markdown with XSS protection and custom video syntax
     * @param {string} markdown - Markdown content to parse
     * @returns {string} - Sanitized HTML
     */
    function parseMarkdown(markdown) {
        // Pre-process custom video syntax: !video(url) -> <video-embed>url</video-embed>
        // This prevents marked.js from treating it as regular text
        let processedMarkdown = markdown.replace(/!video\((.*?)\)/g, (match, url) => {
            if (!isValidUrl(url)) {
                return '[Invalid video URL]';
            }
            return `<div class="video-container"><iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        });

        // Pre-process row blocks: <!-- row -->...<!-- /row --> into HTML structure
        // Format: <!-- row -->\nleftContent\n<!-- col -->\nrightContent\n<!-- /row -->
        processedMarkdown = processedMarkdown.replace(
            /<!--\s*row\s*-->\s*([\s\S]*?)\s*<!--\s*col\s*-->\s*([\s\S]*?)\s*<!--\s*\/row\s*-->/g,
            (match, col1, col2) => {
                // Parse each column's content through marked first
                const col1Html = marked.parse(col1.trim());
                const col2Html = marked.parse(col2.trim());
                return `<div class="row-container"><div class="row-col">${col1Html}</div><div class="row-col">${col2Html}</div></div>`;
            }
        );

        // Pre-process callout blocks: parse inner markdown content
        processedMarkdown = processedMarkdown.replace(
            /<div class="callout">([\s\S]*?)<\/div>/g,
            (match, content) => {
                const contentHtml = marked.parse(content.trim());
                return `<div class="callout">${contentHtml}</div>`;
            }
        );

        // Parse markdown with marked.js
        const rawHtml = marked.parse(processedMarkdown);

        // Sanitize with DOMPurify, allowing images, video iframes, collapsible sections, and forms
        // Note: HTML comments (like <!-- block --> separators) are automatically stripped
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['iframe', 'details', 'summary', 'input', 'textarea', 'button', 'label', 'select', 'option', 'form'],
            ADD_ATTR: [
                'allow', 'allowfullscreen', 'frameborder', 'src', 'alt', 'title', 'open', 'style',
                // Form attributes
                'data-form', 'type', 'name', 'id', 'for', 'required', 'placeholder', 'value',
                'rows', 'cols', 'min', 'max', 'minlength', 'maxlength', 'pattern', 'disabled',
                'checked', 'selected', 'multiple', 'autocomplete', 'aria-label'
            ],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        });

        return cleanHtml;
    }

    function updateCardStack() {
        STATE.cardElements.forEach((card, index) => {
            const stackIndex = index - STATE.currentIndex;

            if (stackIndex < 0 || stackIndex >= CONFIG.VISIBLE_CARDS) {
                applyHiddenCardStyles(card);
            } else if (stackIndex === 0) {
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS;
                card.style.pointerEvents = 'auto';
                card.style.transform = `rotate(0deg)`;
            } else {
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS - stackIndex;
                card.style.pointerEvents = 'none';
                const scale = 1 - (stackIndex * CONFIG.SCALE_FACTOR);
                const translateY = -stackIndex * CONFIG.TRANSLATE_FACTOR;
                const rotation = CONFIG.CARD_ANGLES[stackIndex] || 0;
                card.style.transform = `scale(${scale}) translateY(${translateY}px) rotate(${rotation}deg)`;
            }
        });

        // Update buttons
        UI.prevBtn.disabled = STATE.currentIndex === 0;
        UI.nextBtn.disabled = STATE.currentIndex >= STATE.cards.length - 1;

        // Update progress (handle empty deck edge case)
        let progress = 0;
        if (STATE.cards.length === 0) {
            progress = 0;
        } else if (STATE.cards.length <= 1) {
            progress = 100;
        } else {
            progress = (STATE.currentIndex / (STATE.cards.length - 1)) * 100;
        }

        const progressInner = UI.progressBar.querySelector('div');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
        UI.progressBar.setAttribute('aria-valuenow', Math.round(progress));
    }

    function enableCardTransitions() {
        STATE.cardElements.forEach(card => {
            card.style.transition = CONFIG.TRANSITION_CSS;
        });
    }

    function disableCardTransitions() {
        STATE.cardElements.forEach(card => {
            // Keep transition explicitly disabled with inline style
            card.style.transition = 'none';
        });
    }

    function animateCardTransition(direction) {
        if (STATE.isAnimating) return false;

        STATE.isAnimating = true;
        const currentCard = STATE.cardElements[STATE.currentIndex];

        if (direction === 'forward') {
            // Enable transitions on all cards for smooth stack movement
            enableCardTransitions();

            // Animate current card sliding out to the left
            currentCard.style.transform = `translateX(${CONFIG.THROW_DISTANCE}) rotate(${CONFIG.THROW_ROTATION})`;
            currentCard.style.opacity = '0';

            // Update stack after a brief delay so the slide starts first
            setTimeout(() => {
                STATE.currentIndex++;
                updateCardStack();
                updateQueryParam();
            }, CONFIG.STACK_UPDATE_DELAY);

            setTimeout(() => {
                // Reset the outgoing card's inline styles
                disableCardTransitions();
                resetCardInlineStyles(currentCard);

                STATE.isAnimating = false;
            }, CONFIG.TRANSITION_DURATION);
        } else if (direction === 'backward') {
            // Move to previous card index
            const previousIndex = STATE.currentIndex - 1;
            const prevCard = STATE.cardElements[previousIndex];

            // Position the previous card off to the left (starting position)
            prevCard.style.transition = 'none';
            prevCard.style.transform = `translateX(${CONFIG.THROW_DISTANCE}) rotate(${CONFIG.THROW_ROTATION})`;
            prevCard.style.opacity = '0';
            prevCard.style.zIndex = CONFIG.VISIBLE_CARDS + 1;

            // Update index
            STATE.currentIndex = previousIndex;

            // Force reflow to apply the starting position
            prevCard.offsetHeight;

            // Enable transitions for smooth animation
            enableCardTransitions();

            // Animate the previous card sliding in from the left
            prevCard.style.transform = 'translateX(0) rotate(0deg)';
            prevCard.style.opacity = '1';

            // Also update the stack for cards behind
            updateCardStack();

            setTimeout(() => {
                // Reset inline styles
                disableCardTransitions();
                resetCardInlineStyles(prevCard);

                // Final stack update
                updateCardStack();
                updateQueryParam();

                STATE.isAnimating = false;
            }, CONFIG.TRANSITION_DURATION);
        }

        return true;
    }

    function nextCard() {
        if (STATE.currentIndex < STATE.cards.length - 1 && !STATE.isAnimating) {
            animateCardTransition('forward');
        }
    }

    function prevCard() {
        if (STATE.currentIndex > 0 && !STATE.isAnimating) {
            animateCardTransition('backward');
        }
    }

    function updateQueryParam() {
        const params = new URLSearchParams(window.location.search);
        params.set('card', STATE.currentIndex);
        // Preserve editing state if present
        if (STATE.editingCardIndex !== -1) {
            params.set('editing', 'true');
        }
        window.history.replaceState(null, '', '?' + params.toString());
    }

    /**
     * Initialize the viewer and load session content
     */
    async function init() {
        const params = new URLSearchParams(window.location.search);
        const sessionFile = params.get('file') || 'session-01';
        const initialCardIndex = parseInt(params.get('card') || '0', 10);

        // Store session file in state
        STATE.sessionFile = sessionFile;

        try {
            const response = await fetch(`sessions/${sessionFile}.md`);
            if (!response.ok) throw new Error('Network response was not ok');
            const markdown = await response.text();

            document.title = 'GrowthLab Session';

            STATE.cards = markdown.split(/\n\s*---\s*\n/);

            UI.cardStack.innerHTML = '';
            STATE.cardElements = STATE.cards.map((cardMarkdown, index) => {
                const card = document.createElement('article');
                card.className = 'card';
                card.innerHTML = parseMarkdown(cardMarkdown);

                UI.cardStack.appendChild(card);
                return card;
            });

            STATE.currentIndex = Math.max(0, Math.min(initialCardIndex, STATE.cards.length - 1));

            UI.progressBar.innerHTML = `<div style="width: 0%; height: 100%; background-color: var(--primary); transition: width 0.3s ease;"></div>`;

            updateCardStack();

            UI.nextBtn.addEventListener('click', nextCard);
            UI.prevBtn.addEventListener('click', prevCard);
            document.addEventListener('keydown', (e) => {
                // Navigation (disabled when editing)
                if (STATE.editingCardIndex === -1) {
                    if (e.key === 'ArrowRight') nextCard();
                    if (e.key === 'ArrowLeft') prevCard();
                }
            });

            // Initialize edit mode if available
            if (isDevMode && typeof window.initEditMode === 'function') {
                const editMode = window.initEditMode(STATE, {
                    parseMarkdown,
                    isDevMode,
                });

                // Add edit buttons to all cards
                STATE.cardElements.forEach((card, index) => {
                    editMode.addEditButtonToCard(card, index);
                });

                // Setup keyboard shortcuts
                editMode.setupEditModeKeyboardShortcuts();

                // Auto-enter edit mode if editing param is in URL
                const shouldEnterEditMode = params.get('editing') === 'true';
                if (shouldEnterEditMode) {
                    editMode.enterEditMode(STATE.currentIndex);
                }

                // Show dev mode indicator
                console.log('🔧 Edit mode enabled');
                console.log('   Cmd/Ctrl+E: Edit current card');
                console.log('   Cmd/Ctrl+S: Save changes');
                console.log('   Esc: Cancel editing');
            }

        } catch (error) {
            console.error('Failed to load session:', error);
            UI.cardStack.innerHTML = `<article class="card"><h1>Error</h1><p>Could not load session file.</p></article>`;
        }
    }

    init();
});
