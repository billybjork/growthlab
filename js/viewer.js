document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        cards: [],
        cardElements: [],
        currentIndex: 0,
        scrollVelocity: 0,
        lastScrollTime: 0,
        scrollAccum: 0,
        isAnimating: false,
    };

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
        ROTATION_FACTOR: 2, // degrees
        FLING_THRESHOLD: 100, // pixels for pointer drag
        SCROLL_THRESHOLD: 300, // pixels for scroll wheel (much higher)
    };

    function parseMarkdown(markdown) {
        const lines = markdown.trim().split('\n');
        let html = '';
        let inList = false;

        lines.forEach(line => {
            const trimmed = line.trim();

            if (trimmed.startsWith('# ')) {
                html += `<h1>${trimmed.substring(2)}</h1>`;
            } else if (trimmed.startsWith('## ')) {
                html += `<h2>${trimmed.substring(3)}</h2>`;
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${trimmed.substring(2)}</li>`;
            } else if (inList && trimmed === '') {
                html += '</ul>';
                inList = false;
            } else if (trimmed.match(/^!video\((.*)\)$/)) {
                const url = trimmed.match(/^!video\((.*)\)$/)[1];
                html += `<div class="video-container"><iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            } else if (trimmed.match(/^!\[(.*)\]\((.*)\)$/)) {
                const [, alt, src] = trimmed.match(/^!\[(.*)\]\((.*)\)$/);
                html += `<img src="${src}" alt="${alt}">`;
            } else if (trimmed.match(/^\[(.*)\]\((.*)\)$/)) {
                const [, text, url] = trimmed.match(/^\[(.*)\]\((.*)\)$/);
                html += `<p><a href="${url}" target="_blank">${text}</a></p>`;
            } else if (trimmed !== '') {
                html += `<p>${trimmed}</p>`;
            }
        });

        if (inList) html += '</ul>';
        return html;
    }
    
    function onWheel(e) {
        if (e.target.closest('a, button, iframe')) return;
        if (STATE.isAnimating) return; // Don't scroll while animating

        // Only respond to horizontal scroll
        const deltaX = e.deltaX || (e.shiftKey ? e.deltaY : 0);
        if (Math.abs(deltaX) < 5) return; // Ignore small movements

        e.preventDefault();

        const topCard = STATE.cardElements[STATE.currentIndex];
        if (!topCard) return;

        // Accumulate scroll (invert so dragging motion matches card motion)
        STATE.scrollAccum -= deltaX;

        // Clamp to prevent over-scrolling
        STATE.scrollAccum = Math.max(-400, Math.min(400, STATE.scrollAccum));

        // Remove transition for smooth real-time follow
        topCard.style.transition = 'none';

        // Move card with scroll
        topCard.style.transform = `translate(${STATE.scrollAccum}px, 0) rotate(${STATE.scrollAccum * 0.05}deg)`;

        // Check if should complete swipe
        const threshold = CONFIG.SCROLL_THRESHOLD;
        if (Math.abs(STATE.scrollAccum) > threshold) {
            completeScroll();
        }
    }

    function completeScroll() {
        STATE.isAnimating = true;

        // Prevent going past the end
        if (STATE.currentIndex >= STATE.cards.length - 1) {
            STATE.isAnimating = false;
            STATE.scrollAccum = 0;
            resetScroll();
            return;
        }

        const topCard = STATE.cardElements[STATE.currentIndex];
        if (!topCard) return;

        // Just hide the card instantly - no animation, no transform changes
        topCard.style.transition = 'none';
        topCard.style.opacity = '0';
        topCard.style.pointerEvents = 'none';

        // Always go forward regardless of swipe direction
        STATE.currentIndex++;
        STATE.scrollAccum = 0;
        STATE.scrollVelocity = 0;
        updateNav();
        updateQueryParam();

        // Animation complete - just unlock for next interaction
        setTimeout(() => {
            STATE.isAnimating = false;
        }, 350);
    }

    function resetScroll() {
        const topCard = STATE.cardElements[STATE.currentIndex];
        if (!topCard) return;

        topCard.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        topCard.style.transform = 'translate(0, 0) rotate(0)';
        STATE.scrollAccum = 0;
        STATE.scrollVelocity = 0;
    }

    function onWheelEnd() {
        // Don't do anything if we're already animating a swipe
        if (STATE.isAnimating) return;

        // After scroll stops, check if we should complete or reset
        if (Math.abs(STATE.scrollAccum) > CONFIG.SCROLL_THRESHOLD) {
            completeScroll();
        } else if (Math.abs(STATE.scrollAccum) > 0) {
            resetScroll();
        }
    }

    function onPointerDown(e) {
        if (e.target.closest('a, button, iframe')) return;
        if (STATE.isAnimating) return;

        STATE.isDragging = true;
        STATE.dragStart = { x: e.clientX, y: e.clientY };
        STATE.dragStartTime = Date.now();
        STATE.currentDragX = 0;

        const topCard = STATE.cardElements[STATE.currentIndex];
        if (topCard) {
            topCard.style.transition = 'none';
        }
    }

    function onPointerMove(e) {
        if (!STATE.isDragging || !STATE.dragStart) return;

        const deltaX = e.clientX - STATE.dragStart.x;
        const deltaY = e.clientY - STATE.dragStart.y;

        // Update position regardless of direction
        STATE.currentDragX = deltaX;
        const topCard = STATE.cardElements[STATE.currentIndex];
        if (topCard) {
            topCard.style.transform = `translate(${deltaX}px, 0) rotate(${deltaX * 0.05}deg)`;
        }
    }

    function onPointerUp(e) {
        if (!STATE.isDragging || !STATE.dragStart) return;

        STATE.isDragging = false;
        const deltaX = e.clientX - STATE.dragStart.x;
        const deltaTime = Date.now() - STATE.dragStartTime;

        // Calculate velocity
        const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);

        // Complete swipe if: far enough distance OR fast velocity
        const shouldSwipe = Math.abs(deltaX) > CONFIG.FLING_THRESHOLD || velocity > 0.3;

        const topCard = STATE.cardElements[STATE.currentIndex];
        if (topCard) {
            if (shouldSwipe && Math.abs(deltaX) > 0 && STATE.currentIndex < STATE.cards.length - 1) {
                // Complete the swipe - just hide the card instantly
                STATE.isAnimating = true;
                topCard.style.transition = 'none';
                topCard.style.opacity = '0';
                topCard.style.pointerEvents = 'none';
                STATE.currentIndex++;
                updateNav();
                updateQueryParam();
                setTimeout(() => {
                    STATE.isAnimating = false;
                }, 350);
            } else {
                // Snap back
                topCard.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                topCard.style.transform = 'translate(0, 0) rotate(0)';
            }
        }

        STATE.dragStart = null;
        STATE.dragStartTime = null;
        STATE.currentDragX = 0;
    }

    function updateCardStack(animate = true, skipIndex = -1) {
        STATE.cardElements.forEach((card, index) => {
            // Skip the card that's currently animating away
            if (index === skipIndex) return;

            const stackIndex = index - STATE.currentIndex;
            card.style.transition = animate ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease' : 'none';

            if (stackIndex < 0) { // Viewed cards
                card.style.transform = `translateX(-150%) rotate(-30deg)`;
                card.style.opacity = '0';
                card.style.zIndex = 0;
            } else if (stackIndex === 0) { // Top card
                card.style.transform = 'scale(1) translateY(0)';
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS;
            } else if (stackIndex < CONFIG.VISIBLE_CARDS) { // Visible stack
                const scale = 1 - (stackIndex * CONFIG.SCALE_FACTOR);
                const translateY = -stackIndex * CONFIG.TRANSLATE_FACTOR;
                card.style.transform = `scale(${scale}) translateY(${translateY}px)`;
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS - stackIndex;
            } else { // Hidden deep in stack
                card.style.transform = 'scale(0.8) translateY(-40px)';
                card.style.opacity = '0';
                card.style.zIndex = '0';
            }
        });
        updateNav();
    }

    function swipeCard() {
        if (STATE.currentIndex >= STATE.cards.length) return;

        STATE.currentIndex++;
        updateCardStack(true);
        updateQueryParam();
    }

    function showPrevCard() {
        if (STATE.currentIndex <= 0) return;
        STATE.currentIndex--;
        updateCardStack(true);
        updateQueryParam();
    }

    function updateProgressBar() {
        const progress = STATE.cards.length > 0 ? (STATE.currentIndex / STATE.cards.length) * 100 : 0;
        const progressInner = UI.progressBar.querySelector('div');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
    }

    function updateNav() {
        UI.prevBtn.disabled = STATE.currentIndex === 0;
        UI.nextBtn.disabled = STATE.currentIndex >= STATE.cards.length;
        updateProgressBar();
    }

    function updateQueryParam() {
        const params = new URLSearchParams(window.location.search);
        params.set('card', STATE.currentIndex);
        window.history.replaceState(null, '', '?' + params.toString());
    }

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const sessionFile = params.get('file') || 'session-01';
        const initialCardIndex = parseInt(params.get('card') || '0', 10);

        try {
            const response = await fetch(`sessions/${sessionFile}.md`);
            if (!response.ok) throw new Error('Network response was not ok');
            const markdown = await response.text();

            STATE.cards = markdown.split(/\n\s*---\s*\n/);

            UI.cardStack.innerHTML = '';
            STATE.cardElements = STATE.cards.map((cardMarkdown) => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = parseMarkdown(cardMarkdown);
                // Assign a pseudo-random but consistent seed for rotation
                card.dataset.seed = Math.floor(Math.random() * 10);
                UI.cardStack.appendChild(card);
                return card;
            });

            // Set initial card index from query param, clamp to valid range
            STATE.currentIndex = Math.max(0, Math.min(initialCardIndex, STATE.cards.length - 1));

            updateCardStack(false);
            UI.progressBar.innerHTML = `<div style="width: 0%; height: 100%; background-color: var(--accent); transition: width 0.3s ease;"></div>`;
            updateProgressBar();

            // Attach scroll listener
            UI.cardStack.addEventListener('wheel', onWheel, { passive: false });
            let wheelTimeout;
            UI.cardStack.addEventListener('wheel', () => {
                clearTimeout(wheelTimeout);
                wheelTimeout = setTimeout(onWheelEnd, 100);
            }, { passive: false });

            // Attach pointer listeners for drag
            window.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);

            UI.nextBtn.addEventListener('click', () => swipeCard());
            UI.prevBtn.addEventListener('click', showPrevCard);
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') swipeCard();
                if (e.key === 'ArrowLeft') showPrevCard();
            });

        } catch (error) {
            console.error('Failed to load session:', error);
            UI.cardStack.innerHTML = `<div class="card"><h1>Error</h1><p>Could not load session file. Please check the console.</p></div>`;
        }
    }

    init();
});