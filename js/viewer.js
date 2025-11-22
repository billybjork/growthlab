document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        cards: [],
        cardElements: [],
        currentIndex: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartTime: 0,
        dragCurrentX: 0,
        dragCurrentY: 0,
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
        DRAG_THRESHOLD: 80,
        VELOCITY_THRESHOLD: 500,
        CARD_ANGLES: [0, 1.5, -1.5, 1.5],
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

    function updateCardStack(dragOffsetX = 0, dragOffsetY = 0) {
        STATE.cardElements.forEach((card, index) => {
            const stackIndex = index - STATE.currentIndex;

            if (stackIndex < 0) {
                card.style.opacity = '0';
                card.style.zIndex = 0;
                card.style.pointerEvents = 'none';
                card.style.transform = 'scale(0.8) translateY(-40px)';
            } else if (stackIndex === 0) {
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS;
                card.style.pointerEvents = 'auto';
                const scale = 1;
                card.style.transform = `translateX(${dragOffsetX}px) translateY(${dragOffsetY}px) rotate(0deg)`;
            } else if (stackIndex < CONFIG.VISIBLE_CARDS) {
                card.style.opacity = '1';
                card.style.zIndex = CONFIG.VISIBLE_CARDS - stackIndex;
                card.style.pointerEvents = 'none';
                const scale = 1 - (stackIndex * CONFIG.SCALE_FACTOR);
                const translateY = -stackIndex * CONFIG.TRANSLATE_FACTOR;
                const rotation = CONFIG.CARD_ANGLES[stackIndex] || 0;
                card.style.transform = `scale(${scale}) translateY(${translateY}px) rotate(${rotation}deg)`;
            } else {
                card.style.opacity = '0';
                card.style.zIndex = 0;
                card.style.pointerEvents = 'none';
                card.style.transform = 'scale(0.8) translateY(-40px)';
            }
        });

        // Update buttons
        UI.prevBtn.disabled = STATE.currentIndex === 0;
        UI.nextBtn.disabled = STATE.currentIndex >= STATE.cards.length - 1;

        // Update progress
        const progress = STATE.cards.length <= 1 ? 100 : (STATE.currentIndex / (STATE.cards.length - 1)) * 100;
        const progressInner = UI.progressBar.querySelector('div');
        if (progressInner) {
            progressInner.style.width = `${progress}%`;
        }
    }

    function enableCardTransitions() {
        STATE.cardElements.forEach(card => {
            card.style.transition = 'transform 450ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 450ms ease, z-index 0s';
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
            currentCard.style.transform = 'translateX(-150%) rotate(-10deg)';
            currentCard.style.opacity = '0';

            // Update stack after a brief delay so the slide starts first
            setTimeout(() => {
                STATE.currentIndex++;
                updateCardStack();
                updateQueryParam();
            }, 100);

            setTimeout(() => {
                // Reset the outgoing card's inline styles
                disableCardTransitions();
                currentCard.style.transform = '';
                currentCard.style.opacity = '';

                STATE.isAnimating = false;
            }, 450);
        } else if (direction === 'backward') {
            // Move to previous card index
            const previousIndex = STATE.currentIndex - 1;
            const prevCard = STATE.cardElements[previousIndex];

            // Position the previous card off to the left (starting position)
            prevCard.style.transition = 'none';
            prevCard.style.transform = 'translateX(-150%) rotate(-10deg)';
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
                prevCard.style.transform = '';
                prevCard.style.opacity = '';
                prevCard.style.zIndex = '';

                // Final stack update
                updateCardStack();
                updateQueryParam();

                STATE.isAnimating = false;
            }, 450);
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
        window.history.replaceState(null, '', '?' + params.toString());
    }

    function handleDragStart(e) {
        if (STATE.currentIndex >= STATE.cards.length - 1 || STATE.isAnimating) return;

        // Ensure all transitions are disabled for immediate drag response
        disableCardTransitions();

        const currentCard = STATE.cardElements[STATE.currentIndex];
        currentCard.classList.add('dragging');

        STATE.isDragging = true;
        STATE.dragStartX = e.clientX || e.touches?.[0]?.clientX || 0;
        STATE.dragStartY = e.clientY || e.touches?.[0]?.clientY || 0;
        STATE.dragStartTime = Date.now();
        STATE.dragCurrentX = STATE.dragStartX;
        STATE.dragCurrentY = STATE.dragStartY;
    }

    function handleDragMove(e) {
        if (!STATE.isDragging) return;

        STATE.dragCurrentX = e.clientX || e.touches?.[0]?.clientX || 0;
        STATE.dragCurrentY = e.clientY || e.touches?.[0]?.clientY || 0;

        const dragDistanceX = STATE.dragCurrentX - STATE.dragStartX;
        const dragDistanceY = STATE.dragCurrentY - STATE.dragStartY;

        updateCardStack(dragDistanceX, dragDistanceY);
    }

    function handleDragEnd() {
        if (!STATE.isDragging) return;

        STATE.isDragging = false;
        const currentCard = STATE.cardElements[STATE.currentIndex];
        currentCard.classList.remove('dragging');

        const dragDistanceX = STATE.dragCurrentX - STATE.dragStartX;
        const dragDistanceY = STATE.dragCurrentY - STATE.dragStartY;
        const totalDistance = Math.sqrt(dragDistanceX ** 2 + dragDistanceY ** 2);

        const dragTime = Date.now() - STATE.dragStartTime;
        const dragTimeSeconds = dragTime / 1000;

        // Calculate velocity components (px/s)
        const velocityX = dragTimeSeconds > 0 ? dragDistanceX / dragTimeSeconds : 0;
        const velocityY = dragTimeSeconds > 0 ? dragDistanceY / dragTimeSeconds : 0;
        const totalVelocity = Math.sqrt(velocityX ** 2 + velocityY ** 2);

        const shouldAdvance = totalDistance > CONFIG.DRAG_THRESHOLD || totalVelocity > CONFIG.VELOCITY_THRESHOLD;

        if (shouldAdvance && STATE.currentIndex < STATE.cards.length - 1) {
            // Advance to next card with animation
            nextCard();
        } else {
            // Snap back to center
            updateCardStack(0, 0);
        }
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
                UI.cardStack.appendChild(card);
                return card;
            });

            STATE.currentIndex = Math.max(0, Math.min(initialCardIndex, STATE.cards.length - 1));

            UI.progressBar.innerHTML = `<div style="width: 0%; height: 100%; background-color: var(--accent); transition: width 0.3s ease;"></div>`;

            updateCardStack();

            UI.nextBtn.addEventListener('click', nextCard);
            UI.prevBtn.addEventListener('click', prevCard);
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') nextCard();
                if (e.key === 'ArrowLeft') prevCard();
            });

            UI.cardStack.addEventListener('pointerdown', handleDragStart);
            document.addEventListener('pointermove', handleDragMove);
            document.addEventListener('pointerup', handleDragEnd);

        } catch (error) {
            console.error('Failed to load session:', error);
            UI.cardStack.innerHTML = `<div class="card"><h1>Error</h1><p>Could not load session file.</p></div>`;
        }
    }

    init();
});
