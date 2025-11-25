document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        cards: [],
        cardElements: [],
        currentIndex: 0,
        isAnimating: false,
        editingCardIndex: -1,  // Used by edit-mode.js
        presenterMode: false,
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

        // Pre-process text-align blocks: parse inner markdown content
        processedMarkdown = processedMarkdown.replace(
            /<div style="text-align:\s*(left|center|right)">([\s\S]*?)<\/div>/g,
            (match, align, content) => {
                const contentHtml = marked.parse(content.trim());
                return `<div style="text-align: ${align}">${contentHtml}</div>`;
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
                'checked', 'selected', 'multiple', 'autocomplete', 'aria-label',
                // Link attributes for new tab behavior
                'target', 'rel'
            ],
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        });

        // Make all links open in new tabs
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanHtml;
        tempDiv.querySelectorAll('a[href]').forEach(link => {
            // Only add target="_blank" to external links (not anchors)
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#')) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });

        return tempDiv.innerHTML;
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

    /**
     * Navigate directly to a specific card index with carousel-style animation
     * @param {number} targetIndex - The card index to navigate to
     */
    function goToCard(targetIndex) {
        // Clamp to valid range
        targetIndex = Math.max(0, Math.min(targetIndex, STATE.cards.length - 1));

        // Skip if already at target or animating
        if (targetIndex === STATE.currentIndex || STATE.isAnimating) return;

        STATE.isAnimating = true;
        const currentCard = STATE.cardElements[STATE.currentIndex];
        const targetCard = STATE.cardElements[targetIndex];
        const goingForward = targetIndex > STATE.currentIndex;

        // Animation constants for carousel-style slide
        const JUMP_DISTANCE = '40%';
        const JUMP_DURATION = 300;
        const EASE_OUT = 'cubic-bezier(0.4, 0, 1, 1)';
        const EASE_IN_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

        // Current card exits in navigation direction (forward = left, backward = right)
        currentCard.style.transition = `transform ${JUMP_DURATION}ms ${EASE_OUT}, opacity ${JUMP_DURATION}ms ease`;
        currentCard.style.transform = `translateX(${goingForward ? '-' : ''}${JUMP_DISTANCE})`;
        currentCard.style.opacity = '0';

        // Target card starts from opposite direction
        targetCard.style.transition = 'none';
        targetCard.style.transform = `translateX(${goingForward ? '' : '-'}${JUMP_DISTANCE})`;
        targetCard.style.opacity = '0';
        targetCard.style.zIndex = CONFIG.VISIBLE_CARDS + 1;
        targetCard.style.pointerEvents = 'auto';

        // Force reflow
        targetCard.offsetHeight;

        // Animate target card in with spring easing
        targetCard.style.transition = `transform ${JUMP_DURATION}ms ${EASE_IN_SPRING}, opacity ${JUMP_DURATION}ms ease`;
        targetCard.style.transform = 'translateX(0)';
        targetCard.style.opacity = '1';

        // Update index immediately for progress bar
        STATE.currentIndex = targetIndex;
        updateCardStack();

        setTimeout(() => {
            disableCardTransitions();
            resetCardInlineStyles(currentCard);
            resetCardInlineStyles(targetCard);
            updateCardStack();
            updateQueryParam();
            STATE.isAnimating = false;
        }, JUMP_DURATION);
    }

    /**
     * Calculate card index from progress bar position
     * @param {number} x - X position relative to progress bar
     * @param {number} width - Width of progress bar
     * @returns {number} - Card index
     */
    function getCardIndexFromProgress(x, width) {
        const ratio = Math.max(0, Math.min(1, x / width));
        return Math.round(ratio * (STATE.cards.length - 1));
    }

    /**
     * Setup image lightbox for fullscreen viewing
     */
    function setupImageLightbox() {
        // Create lightbox elements
        const lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';

        const img = document.createElement('img');
        img.alt = 'Fullscreen image';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'image-lightbox-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close lightbox');

        lightbox.appendChild(img);
        lightbox.appendChild(closeBtn);
        document.body.appendChild(lightbox);

        // Update URL with image param
        function updateImageParam(imageIndex) {
            const params = new URLSearchParams(window.location.search);
            if (imageIndex !== null) {
                params.set('image', imageIndex);
            } else {
                params.delete('image');
            }
            window.history.replaceState(null, '', '?' + params.toString());
        }

        // Close lightbox function
        function closeLightbox() {
            lightbox.classList.remove('visible');
            updateImageParam(null);
        }

        // Open lightbox function
        function openLightbox(src, imageIndex) {
            img.src = src;
            // Reset any previous sizing
            img.style.width = '';
            img.style.height = '';

            // Update URL if index provided
            if (imageIndex !== undefined) {
                updateImageParam(imageIndex);
            }

            // Once image loads, scale up if needed
            img.onload = () => {
                const naturalW = img.naturalWidth;
                const naturalH = img.naturalHeight;
                const viewportW = window.innerWidth;
                const viewportH = window.innerHeight;

                // Target: at least 75% of viewport, max 90%
                const minScale = 0.75;
                const maxScale = 0.90;

                // Calculate scale needed to reach minimum size
                const scaleToFitW = (viewportW * minScale) / naturalW;
                const scaleToFitH = (viewportH * minScale) / naturalH;
                const scaleUp = Math.min(scaleToFitW, scaleToFitH);

                // Only scale up if image is smaller than target
                if (scaleUp > 1) {
                    // Cap at max viewport percentage
                    const maxW = viewportW * maxScale;
                    const maxH = viewportH * maxScale;
                    const finalW = Math.min(naturalW * scaleUp, maxW);
                    const finalH = Math.min(naturalH * scaleUp, maxH);

                    img.style.width = `${finalW}px`;
                    img.style.height = `${finalH}px`;
                }
            };

            lightbox.classList.add('visible');
        }

        // Close on X button click
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeLightbox();
        });

        // Close on overlay click (but not on image)
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('visible')) {
                closeLightbox();
            }
        });

        // Add click handlers to card images
        UI.cardStack.addEventListener('click', (e) => {
            const clickedImg = e.target.closest('.card img');
            if (clickedImg && !clickedImg.closest('.editing')) {
                // Find image index within current card
                const currentCard = STATE.cardElements[STATE.currentIndex];
                const images = currentCard.querySelectorAll('img');
                const imageIndex = Array.from(images).indexOf(clickedImg);
                openLightbox(clickedImg.src, imageIndex);
            }
        });

        // Check for image param on load
        const params = new URLSearchParams(window.location.search);
        const imageParam = params.get('image');
        if (imageParam !== null) {
            const imageIndex = parseInt(imageParam, 10);
            const currentCard = STATE.cardElements[STATE.currentIndex];
            const images = currentCard.querySelectorAll('img');
            if (images[imageIndex]) {
                openLightbox(images[imageIndex].src, imageIndex);
            }
        }
    }

    /**
     * Setup progress bar click and hover functionality
     */
    function setupProgressBarNavigation() {
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'progress-tooltip';
        UI.progressBar.appendChild(tooltip);

        // Create indicator line
        const indicator = document.createElement('div');
        indicator.className = 'progress-indicator';
        UI.progressBar.appendChild(indicator);

        // Update tooltip and indicator position
        function updateHoverState(x) {
            const rect = UI.progressBar.getBoundingClientRect();
            const barWidth = rect.width;
            const clampedX = Math.max(0, Math.min(x, barWidth));
            const cardIndex = getCardIndexFromProgress(clampedX, barWidth);

            // Update tooltip text and position
            tooltip.textContent = `${cardIndex + 1} / ${STATE.cards.length}`;
            tooltip.style.left = `${clampedX}px`;

            // Update indicator position
            indicator.style.left = `${clampedX - 1}px`;
        }

        // Mouse events
        UI.progressBar.addEventListener('mousemove', (e) => {
            const rect = UI.progressBar.getBoundingClientRect();
            updateHoverState(e.clientX - rect.left);
        });

        UI.progressBar.addEventListener('click', (e) => {
            const rect = UI.progressBar.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const targetIndex = getCardIndexFromProgress(x, rect.width);
            goToCard(targetIndex);
        });

        // Touch events for mobile scrubbing
        let isTouching = false;

        UI.progressBar.addEventListener('touchstart', (e) => {
            isTouching = true;
            UI.progressBar.classList.add('touching');
            const touch = e.touches[0];
            const rect = UI.progressBar.getBoundingClientRect();
            updateHoverState(touch.clientX - rect.left);
            e.preventDefault();
        }, { passive: false });

        UI.progressBar.addEventListener('touchmove', (e) => {
            if (!isTouching) return;
            const touch = e.touches[0];
            const rect = UI.progressBar.getBoundingClientRect();
            updateHoverState(touch.clientX - rect.left);
            e.preventDefault();
        }, { passive: false });

        UI.progressBar.addEventListener('touchend', (e) => {
            if (!isTouching) return;
            isTouching = false;
            UI.progressBar.classList.remove('touching');

            // Navigate to the card under last touch position
            const tooltipText = tooltip.textContent;
            const match = tooltipText.match(/^(\d+)/);
            if (match) {
                const targetIndex = parseInt(match[1], 10) - 1;
                goToCard(targetIndex);
            }
        });

        UI.progressBar.addEventListener('touchcancel', () => {
            isTouching = false;
            UI.progressBar.classList.remove('touching');
        });
    }

    /**
     * Setup presenter mode (fullscreen presentation view)
     */
    function setupPresenterMode() {
        const appContainer = document.getElementById('app-container');

        // Create presenter button (top-right)
        const presenterBtn = document.createElement('button');
        presenterBtn.id = 'presenter-btn';
        presenterBtn.setAttribute('aria-label', 'Enter presenter mode');
        presenterBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
        appContainer.appendChild(presenterBtn);

        // Create exit button (only visible in presenter mode)
        const exitBtn = document.createElement('button');
        exitBtn.id = 'presenter-exit-btn';
        exitBtn.setAttribute('aria-label', 'Exit presenter mode');
        exitBtn.innerHTML = '&times;';
        document.body.appendChild(exitBtn);

        // Update URL with presenter param
        function updatePresenterParam(isPresenting) {
            const params = new URLSearchParams(window.location.search);
            if (isPresenting) {
                params.set('presenter', 'true');
            } else {
                params.delete('presenter');
            }
            window.history.replaceState(null, '', '?' + params.toString());
        }

        // Enter presenter mode
        async function enterPresenterMode() {
            // Don't enter presenter mode while editing
            if (STATE.editingCardIndex !== -1) return;

            try {
                await document.documentElement.requestFullscreen();
                document.body.classList.add('presenter-mode');
                STATE.presenterMode = true;
                updatePresenterParam(true);
            } catch (err) {
                console.warn('Fullscreen request failed:', err);
            }
        }

        // Exit presenter mode
        function exitPresenterMode() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            document.body.classList.remove('presenter-mode');
            STATE.presenterMode = false;
            updatePresenterParam(false);
        }

        // Toggle presenter mode
        function togglePresenterMode() {
            if (STATE.presenterMode) {
                exitPresenterMode();
            } else {
                enterPresenterMode();
            }
        }

        // Sync state when user exits via Escape or browser UI
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && STATE.presenterMode) {
                document.body.classList.remove('presenter-mode');
                STATE.presenterMode = false;
                updatePresenterParam(false);
            }
        });

        // Button click handlers
        presenterBtn.addEventListener('click', enterPresenterMode);
        exitBtn.addEventListener('click', exitPresenterMode);

        // Keyboard shortcut (P key)
        document.addEventListener('keydown', (e) => {
            // Only when not editing and not in an input field
            if (STATE.editingCardIndex === -1 &&
                !e.target.closest('input, textarea, [contenteditable]') &&
                e.key.toLowerCase() === 'p' &&
                !e.metaKey && !e.ctrlKey && !e.altKey) {
                togglePresenterMode();
            }
        });

        // Check for presenter param on load
        const params = new URLSearchParams(window.location.search);
        if (params.get('presenter') === 'true') {
            // Auto-entering fullscreen requires user gesture, so we show a prompt
            // For now, just add the class but don't request fullscreen
            // User can press P or click button to go fullscreen
            console.log('💡 Press P or click the fullscreen button to enter presenter mode');
        }

        return { enterPresenterMode, exitPresenterMode, togglePresenterMode };
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

            UI.progressBar.innerHTML = `<div style="width: 0%; height: 100%; background-color: var(--primary); transition: width 0.3s ease; border-radius: 4px;"></div>`;

            updateCardStack();
            setupProgressBarNavigation();
            setupImageLightbox();
            setupPresenterMode();

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
