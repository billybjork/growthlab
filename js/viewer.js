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
        momentumVelocityX: 0,
        momentumVelocityY: 0,
        momentumOffsetX: 0,
        momentumOffsetY: 0,
        momentumAnimationId: null,
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
        MOMENTUM_FRICTION: 0.92,
        MOMENTUM_MIN_VELOCITY: 50,
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

    function nextCard() {
        if (STATE.currentIndex < STATE.cards.length - 1) {
            STATE.currentIndex++;
            updateCardStack();
            updateQueryParam();
        }
    }

    function prevCard() {
        if (STATE.currentIndex > 0) {
            STATE.currentIndex--;
            updateCardStack();
            updateQueryParam();
        }
    }

    function updateQueryParam() {
        const params = new URLSearchParams(window.location.search);
        params.set('card', STATE.currentIndex);
        window.history.replaceState(null, '', '?' + params.toString());
    }

    function animateMomentum() {
        if (Math.abs(STATE.momentumVelocityX) < CONFIG.MOMENTUM_MIN_VELOCITY &&
            Math.abs(STATE.momentumVelocityY) < CONFIG.MOMENTUM_MIN_VELOCITY) {
            // Momentum has faded, decide if we should advance or snap back
            const totalDistance = Math.sqrt(STATE.momentumOffsetX ** 2 + STATE.momentumOffsetY ** 2);
            if (totalDistance > CONFIG.DRAG_THRESHOLD && STATE.currentIndex < STATE.cards.length - 1) {
                STATE.isAnimating = true;
                nextCard();
                setTimeout(() => {
                    STATE.isAnimating = false;
                }, 400);
            } else {
                updateCardStack(0, 0);
            }
            STATE.momentumVelocityX = 0;
            STATE.momentumVelocityY = 0;
            STATE.momentumOffsetX = 0;
            STATE.momentumOffsetY = 0;
            return;
        }

        // Apply friction and update offset
        STATE.momentumVelocityX *= CONFIG.MOMENTUM_FRICTION;
        STATE.momentumVelocityY *= CONFIG.MOMENTUM_FRICTION;
        STATE.momentumOffsetX += STATE.momentumVelocityX;
        STATE.momentumOffsetY += STATE.momentumVelocityY;

        updateCardStack(STATE.momentumOffsetX, STATE.momentumOffsetY);

        STATE.momentumAnimationId = requestAnimationFrame(animateMomentum);
    }

    function handleDragStart(e) {
        if (STATE.currentIndex >= STATE.cards.length - 1 || STATE.isAnimating) return;

        // Cancel any ongoing momentum animation
        if (STATE.momentumAnimationId) {
            cancelAnimationFrame(STATE.momentumAnimationId);
            STATE.momentumAnimationId = null;
        }

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
            // High velocity or distance: animate with momentum
            STATE.momentumVelocityX = velocityX;
            STATE.momentumVelocityY = velocityY;
            STATE.momentumOffsetX = dragDistanceX;
            STATE.momentumOffsetY = dragDistanceY;
            STATE.momentumAnimationId = requestAnimationFrame(animateMomentum);
        } else {
            // Low velocity and distance: snap back with momentum feel
            STATE.momentumVelocityX = velocityX * 0.5;
            STATE.momentumVelocityY = velocityY * 0.5;
            STATE.momentumOffsetX = dragDistanceX;
            STATE.momentumOffsetY = dragDistanceY;
            STATE.momentumAnimationId = requestAnimationFrame(animateMomentum);
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
