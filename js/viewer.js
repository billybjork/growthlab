document.addEventListener('DOMContentLoaded', () => {
    const STATE = {
        cards: [],
        currentIndex: 0,
    };

    const UI = {
        cardStack: document.getElementById('card-stack'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        progressBar: document.getElementById('progress-bar'),
    };

    function parseMarkdown(markdown) {
        const lines = markdown.trim().split('\n');
        let html = '';
        lines.forEach(line => {
            if (line.startsWith('# ')) {
                html += `<h1>${line.substring(2)}</h1>`;
            } else if (line.match(/^!video\((.*)\)$/)) {
                const url = line.match(/^!video\((.*)\)$/)[1];
                html += `<div class="video-container"><iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            } else if (line.match(/^!\[(.*)\]\((.*)\)$/)) {
                const alt = line.match(/^!\[(.*)\]\((.*)\)$/)[1];
                const src = line.match(/^!\[(.*)\]\((.*)\)$/)[2];
                html += `<img src="${src}" alt="${alt}">`;
            } else if (line.match(/^\[(.*)\]\((.*)\)$/)) {
                const text = line.match(/^\[(.*)\]\((.*)\)$/)[1];
                const url = line.match(/^\[(.*)\]\((.*)\)$/)[2];
                html += `<p><a href="${url}" target="_blank">${text}</a></p>`;
            } else if (line.trim() !== '') {
                html += `<p>${line}</p>`;
            }
        });
        return html;
    }

    function render() {
        UI.cardStack.innerHTML = '';
        // Get the subset of cards that should be in the DOM, from current index onwards
        const cardsToRender = STATE.cards.slice(STATE.currentIndex);

        // Reverse them for appending, so the current card is the last-child, making it the top of the stack via CSS
        cardsToRender.reverse().forEach(cardMarkdown => {
            const cardIndex = STATE.cards.indexOf(cardMarkdown);
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = parseMarkdown(cardMarkdown);
            card.dataset.index = cardIndex;
            UI.cardStack.appendChild(card);
        });
        updateNav();
    }

    function updateNav() {
        UI.prevBtn.disabled = STATE.currentIndex === 0;
        UI.nextBtn.disabled = STATE.currentIndex >= STATE.cards.length - 1;

        const progressPercent = STATE.cards.length > 1 ? (STATE.currentIndex / (STATE.cards.length - 1)) * 100 : 0;
        UI.progressBar.innerHTML = `<div style="width: ${progressPercent}%; height: 100%; background-color: var(--accent); transition: width 0.3s ease;"></div>`;
    }

    function showNextCard() {
        if (STATE.currentIndex >= STATE.cards.length - 1) return;

        const topCard = UI.cardStack.lastElementChild;
        if (topCard) {
            topCard.classList.add('card-exit-active');
            
            // Wait for animation to finish before removing the element
            setTimeout(() => {
                topCard.remove();
                STATE.currentIndex++;
                updateNav();
            }, 500);
        }
    }

    function showPrevCard() {
        if (STATE.currentIndex <= 0) return;
        
        STATE.currentIndex--;
        render(); // Re-render the deck at the previous state
    }

    async function init() {
        // The URL should contain the session file name, e.g., session.html?file=session-01
        const params = new URLSearchParams(window.location.search);
        const sessionFile = params.get('file') || 'session-01';

        try {
            const response = await fetch(`sessions/${sessionFile}.md`);
            if (!response.ok) throw new Error('Network response was not ok');
            const markdown = await response.text();
            
            STATE.cards = markdown.split(/\n\s*---\s*\n/);
            
            render(); // Initial render

            // Event Listeners
            UI.nextBtn.addEventListener('click', showNextCard);
            UI.prevBtn.addEventListener('click', showPrevCard);

            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') {
                    showNextCard();
                } else if (e.key === 'ArrowLeft') {
                    showPrevCard();
                }
            });

        } catch (error) {
            console.error('Failed to load session:', error);
            UI.cardStack.innerHTML = `<div class="card"><h1>Error</h1><p>Could not load session file. Please check the console.</p></div>`;
        }
    }

    init();
});