/**
 * Edit Mode Card Reorder Strip
 * Transforms navigation into a horizontal strip of numbered card indicators
 * with hover tooltips and drag-to-reorder functionality.
 */
window.EditReorder = (function() {
    // State
    let STATE = null;
    let callbacks = {};
    let sortableInstance = null;
    let tooltipElement = null;
    let isActive = false;

    /**
     * Initialize the reorder module
     * @param {Object} viewerState - The viewer STATE object
     * @param {Object} cbs - Callbacks: { parseMarkdown, showNotification, saveAndNavigate }
     */
    function init(viewerState, cbs) {
        STATE = viewerState;
        callbacks = cbs;
    }

    /**
     * Show the reorder strip (called when entering edit mode)
     */
    async function show() {
        if (isActive) return;
        isActive = true;

        // Load SortableJS if not already loaded
        await loadSortable();

        // Transform navigation
        const navControls = document.getElementById('navigation-controls');
        if (!navControls) return;

        // Hide existing navigation elements
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const progressBar = document.getElementById('progress-bar');

        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';

        // Create reorder strip
        const strip = createReorderStrip();
        navControls.appendChild(strip);

        // Initialize SortableJS
        initSortable(strip);

        // Scroll current card into view
        scrollCurrentIntoView(strip);
    }

    /**
     * Hide the reorder strip (called when exiting edit mode)
     */
    function hide() {
        if (!isActive) return;
        isActive = false;

        // Destroy sortable instance
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }

        // Remove tooltip element
        hideTooltip();
        if (tooltipElement) {
            tooltipElement.remove();
            tooltipElement = null;
        }

        // Remove reorder strip
        const strip = document.querySelector('.card-reorder-strip');
        if (strip) strip.remove();

        // Restore navigation elements
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const progressBar = document.getElementById('progress-bar');

        if (prevBtn) prevBtn.style.display = '';
        if (nextBtn) nextBtn.style.display = '';
        if (progressBar) progressBar.style.display = '';
    }

    /**
     * Create the reorder strip element
     */
    function createReorderStrip() {
        const strip = document.createElement('div');
        strip.className = 'card-reorder-strip';

        // Left navigation arrow
        const leftArrow = document.createElement('button');
        leftArrow.className = 'card-reorder-arrow card-reorder-arrow-left';
        leftArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
        leftArrow.addEventListener('click', () => scrollStrip('left'));
        strip.appendChild(leftArrow);

        // Cards container
        const container = document.createElement('div');
        container.className = 'card-reorder-container';

        STATE.cards.forEach((cardMarkdown, index) => {
            const item = createReorderItem(cardMarkdown, index);
            container.appendChild(item);
        });

        strip.appendChild(container);

        // Right navigation arrow
        const rightArrow = document.createElement('button');
        rightArrow.className = 'card-reorder-arrow card-reorder-arrow-right';
        rightArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
        rightArrow.addEventListener('click', () => scrollStrip('right'));
        strip.appendChild(rightArrow);

        return strip;
    }

    /**
     * Create a single reorder item (numbered card indicator)
     */
    function createReorderItem(cardMarkdown, index) {
        const item = document.createElement('button');
        item.className = 'card-reorder-item';
        item.dataset.cardIndex = index;
        item.textContent = index + 1;

        // Mark current card
        if (index === STATE.currentIndex) {
            item.classList.add('current');
        }

        // Click to navigate (use dataset for current index after potential reordering)
        item.addEventListener('click', (e) => {
            const currentIndex = parseInt(e.currentTarget.dataset.cardIndex, 10);
            navigateToCard(currentIndex);
        });

        // Hover tooltip showing card title (use dataset for current index after potential reordering)
        item.addEventListener('mouseenter', (e) => {
            const currentIndex = parseInt(e.currentTarget.dataset.cardIndex, 10);
            showTooltip(currentIndex, e.currentTarget);
        });

        item.addEventListener('mouseleave', () => {
            hideTooltip();
        });

        return item;
    }

    /**
     * Navigate to a specific card
     */
    async function navigateToCard(index) {
        if (index === STATE.currentIndex) return;

        // If editing, save current card and navigate (staying in edit mode)
        if (STATE.editingCardIndex !== -1 && callbacks.saveAndNavigate) {
            await callbacks.saveAndNavigate(index);
            updateCurrentHighlight();
            return;
        }

        // Not in edit mode - just navigate
        STATE.currentIndex = index;

        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.set('card', index);
        window.history.replaceState(null, '', '?' + params.toString());

        // Update card stack
        window.dispatchEvent(new CustomEvent('cardNavigated'));

        // Update current highlight
        updateCurrentHighlight();
    }

    /**
     * Update which item is highlighted as current
     */
    function updateCurrentHighlight() {
        const items = document.querySelectorAll('.card-reorder-item');
        items.forEach((item, idx) => {
            item.classList.toggle('current', idx === STATE.currentIndex);
        });
    }

    /**
     * Show tooltip with card title
     */
    function showTooltip(index, targetElement) {
        // Create tooltip element if needed
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'card-reorder-tooltip';
            document.body.appendChild(tooltipElement);
        }

        // Get card title
        const title = getCardTitle(STATE.cards[index], index);
        tooltipElement.textContent = title;

        // Position tooltip above the target
        positionTooltip(targetElement);

        // Show tooltip
        tooltipElement.classList.add('visible');
    }

    /**
     * Position tooltip above target, constrained to viewport
     */
    function positionTooltip(targetElement) {
        if (!tooltipElement) return;

        const targetRect = targetElement.getBoundingClientRect();

        // Measure tooltip width (need it visible briefly to measure)
        tooltipElement.style.visibility = 'hidden';
        tooltipElement.style.display = 'block';
        const tooltipWidth = tooltipElement.offsetWidth;
        tooltipElement.style.visibility = '';

        // Calculate position (centered above target)
        let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        let bottom = window.innerHeight - targetRect.top + 8;

        // Constrain to viewport
        const padding = 10;
        if (left < padding) left = padding;
        if (left + tooltipWidth > window.innerWidth - padding) {
            left = window.innerWidth - tooltipWidth - padding;
        }

        tooltipElement.style.left = `${left}px`;
        tooltipElement.style.bottom = `${bottom}px`;
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (tooltipElement) {
            tooltipElement.classList.remove('visible');
        }
    }

    /**
     * Get card title from markdown
     */
    function getCardTitle(cardMarkdown, index) {
        const match = cardMarkdown.match(/^#{2,3}\s+(.+)$/m);
        return match ? match[1].trim() : `Card ${index + 1}`;
    }

    /**
     * Scroll the strip left or right
     */
    function scrollStrip(direction) {
        const container = document.querySelector('.card-reorder-container');
        if (!container) return;

        const scrollAmount = 150;
        container.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }

    /**
     * Scroll current card into view
     */
    function scrollCurrentIntoView(strip) {
        const container = strip.querySelector('.card-reorder-container');
        const currentItem = strip.querySelector('.card-reorder-item.current');

        if (container && currentItem) {
            setTimeout(() => {
                currentItem.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }, 100);
        }
    }

    /**
     * Lazy-load SortableJS from CDN
     */
    async function loadSortable() {
        if (window.Sortable) return;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize SortableJS on the container
     */
    function initSortable(strip) {
        const container = strip.querySelector('.card-reorder-container');
        if (!container || !window.Sortable) return;

        sortableInstance = new Sortable(container, {
            animation: 200,
            easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
            ghostClass: 'card-reorder-item-ghost',
            dragClass: 'card-reorder-item-dragging',
            chosenClass: 'card-reorder-item-chosen',
            direction: 'horizontal',
            delay: 150,  // Delay before drag starts - allows quick clicks for navigation
            delayOnTouchOnly: false,

            onStart: () => {
                hideTooltip();
                container.classList.add('is-sorting');
            },

            onEnd: async (evt) => {
                container.classList.remove('is-sorting');
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;

                if (oldIndex === newIndex) return;

                // Perform the reorder
                await performReorder(oldIndex, newIndex);
            }
        });
    }

    /**
     * Revert DOM order after cancelled drag
     */
    function revertDOMOrder(container) {
        const items = Array.from(container.querySelectorAll('.card-reorder-item'));
        items.sort((a, b) => parseInt(a.dataset.cardIndex) - parseInt(b.dataset.cardIndex));
        items.forEach(item => container.appendChild(item));
    }

    /**
     * Perform the card reorder operation
     */
    async function performReorder(oldIndex, newIndex) {
        try {
            // Save to server
            const response = await fetch('/api/reorder-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionFile: STATE.sessionFile,
                    oldIndex: oldIndex,
                    newIndex: newIndex,
                    cohort: STATE.cohort
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to reorder');
            }

            // Update client state
            reorderClientState(oldIndex, newIndex);

            // Update strip numbering and data attributes
            updateStripAfterReorder();

            if (callbacks.showNotification) {
                callbacks.showNotification('Card reordered');
            }

        } catch (error) {
            console.error('Reorder error:', error);
            // Revert DOM
            const container = document.querySelector('.card-reorder-container');
            if (container) revertDOMOrder(container);

            if (callbacks.showNotification) {
                callbacks.showNotification(`Reorder failed: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Update client-side state after reorder
     */
    function reorderClientState(oldIndex, newIndex) {
        // Reorder cards array
        const [movedCard] = STATE.cards.splice(oldIndex, 1);
        STATE.cards.splice(newIndex, 0, movedCard);

        // Reorder card elements array
        const [movedElement] = STATE.cardElements.splice(oldIndex, 1);
        STATE.cardElements.splice(newIndex, 0, movedElement);

        // Update current index if affected
        if (STATE.currentIndex === oldIndex) {
            STATE.currentIndex = newIndex;
        } else if (oldIndex < STATE.currentIndex && newIndex >= STATE.currentIndex) {
            STATE.currentIndex--;
        } else if (oldIndex > STATE.currentIndex && newIndex <= STATE.currentIndex) {
            STATE.currentIndex++;
        }

        // Update editing card index if affected (keep editing the same card after reorder)
        if (STATE.editingCardIndex !== -1) {
            if (STATE.editingCardIndex === oldIndex) {
                STATE.editingCardIndex = newIndex;
            } else if (oldIndex < STATE.editingCardIndex && newIndex >= STATE.editingCardIndex) {
                STATE.editingCardIndex--;
            } else if (oldIndex > STATE.editingCardIndex && newIndex <= STATE.editingCardIndex) {
                STATE.editingCardIndex++;
            }
        }

        // Update URL
        const params = new URLSearchParams(window.location.search);
        params.set('card', STATE.currentIndex);
        window.history.replaceState(null, '', '?' + params.toString());

        // Update edit button indices on card elements
        STATE.cardElements.forEach((card, idx) => {
            const editBtn = card.querySelector('.edit-card-btn');
            if (editBtn) {
                editBtn.dataset.cardIndex = idx;
            }
        });

        // Trigger card stack update
        window.dispatchEvent(new CustomEvent('cardReordered'));
    }

    /**
     * Update strip items after reorder
     */
    function updateStripAfterReorder() {
        const container = document.querySelector('.card-reorder-container');
        if (!container) return;

        const items = container.querySelectorAll('.card-reorder-item');
        items.forEach((item, index) => {
            item.dataset.cardIndex = index;
            item.textContent = index + 1;
            item.classList.toggle('current', index === STATE.currentIndex);
        });
    }

    /**
     * Refresh the strip (called after card deletion, etc.)
     */
    function refresh() {
        if (!isActive) return;

        // Remove existing strip
        const oldStrip = document.querySelector('.card-reorder-strip');
        if (oldStrip) {
            if (sortableInstance) {
                sortableInstance.destroy();
                sortableInstance = null;
            }
            oldStrip.remove();
        }

        // Recreate
        const navControls = document.getElementById('navigation-controls');
        if (!navControls) return;

        const strip = createReorderStrip();
        navControls.appendChild(strip);
        initSortable(strip);
        scrollCurrentIntoView(strip);
    }

    // Public API
    return {
        init,
        show,
        hide,
        refresh,
        updateCurrentHighlight
    };
})();
