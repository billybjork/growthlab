/**
 * GrowthLab Viewer - Core viewer logic for Markdown-based slide decks
 *
 * Handles:
 * - Loading and parsing Markdown files with YAML front matter
 * - Splitting content into cards based on horizontal rules (---)
 * - Navigation via keyboard, mouse, and URL hash
 * - Rendering with marked.js
 */

class SessionViewer {
  constructor() {
    this.sessionId = '';
    this.cardIndex = 0;
    this.cards = [];
    this.metadata = {};
    this.currentFile = '';

    this.els = {
      sessionMeta: document.getElementById('session-meta'),
      cardContainer: document.getElementById('card-container'),
      status: document.getElementById('status'),
      prevBtn: document.getElementById('prev-btn'),
      nextBtn: document.getElementById('next-btn'),
    };

    this.init();
  }

  /**
   * Initialize the viewer - parse hash, load content, and set up listeners
   */
  async init() {
    this.parseHash();
    if (!this.sessionId) {
      this.showError('No session specified. Use hash like #session-01/0');
      return;
    }

    try {
      await this.loadSession();
      this.render();
      this.setupListeners();
    } catch (error) {
      this.showError(`Failed to load session: ${error.message}`);
    }
  }

  /**
   * Parse URL hash to extract sessionId and cardIndex
   * Expected format: #session-01/3
   */
  parseHash() {
    const hash = window.location.hash.slice(1); // Remove # prefix
    if (!hash) return;

    const [sessionId, cardIndexStr] = hash.split('/');
    this.sessionId = sessionId;
    this.cardIndex = parseInt(cardIndexStr, 10) || 0;
  }

  /**
   * Load the Markdown file and parse it
   */
  async loadSession() {
    const filePath = `sessions/${this.sessionId}.md`;
    this.currentFile = filePath;

    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${filePath} not found`);
    }

    const markdown = await response.text();
    this.parseMarkdown(markdown);
  }

  /**
   * Parse Markdown with YAML front matter
   * Format:
   *   ---
   *   id: session-01
   *   title: "Session Title"
   *   ...
   *   ---
   *   # Markdown content
   */
  parseMarkdown(markdown) {
    let content = markdown;

    // Extract front matter if present
    if (content.startsWith('---')) {
      const secondNewline = content.indexOf('\n---', 4);
      if (secondNewline !== -1) {
        const frontMatterRaw = content.substring(4, secondNewline).trim();
        content = content.substring(secondNewline + 5).trim();
        this.metadata = this.parseFrontMatter(frontMatterRaw);
      }
    }

    // Split content into cards by horizontal rules
    this.splitCards(content);
  }

  /**
   * Parse simple YAML front matter into an object
   * Supports key: value format (no nested structures)
   */
  parseFrontMatter(yaml) {
    const metadata = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (!key.trim()) continue;

      let value = valueParts.join(':').trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Handle arrays (simple list: [item1, item2, item3])
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }

      metadata[key.trim()] = value;
    }

    return metadata;
  }

  /**
   * Split Markdown content into cards using horizontal rules (---) as delimiters
   * Convert each card's Markdown to HTML using marked.js
   */
  splitCards(markdown) {
    // Split by horizontal rules (---)
    // Match lines with 3+ dashes (with optional whitespace)
    const cardTexts = markdown.split(/\n\s*---\s*\n/);

    this.cards = cardTexts.map((cardText, index) => {
      // Parse HTML from Markdown using marked
      const html = marked.parse(cardText.trim());
      return {
        index: index,
        markdown: cardText.trim(),
        html: html,
      };
    });

    // Ensure cardIndex is within bounds
    this.cardIndex = Math.min(this.cardIndex, Math.max(0, this.cards.length - 1));
  }

  /**
   * Render the current state:
   * - Update session metadata header
   * - Render cards with stack effect
   * - Update navigation status
   */
  render() {
    this.renderMetadata();
    this.renderCards();
    this.updateStatus();
  }

  /**
   * Render session metadata in the header
   */
  renderMetadata() {
    const { title, week, day, duration_minutes } = this.metadata;
    let html = '';

    if (title) {
      html += `<h2 class="session-meta__title">${this.escapeHtml(title)}</h2>`;
    }

    const meta = [];
    if (week) meta.push(`Week ${week}`);
    if (day) meta.push(`Day ${day}`);
    if (duration_minutes) meta.push(`${duration_minutes} min`);

    if (meta.length > 0) {
      html += `<div class="session-meta__meta">${meta.join(' · ')}</div>`;
    }

    this.els.sessionMeta.innerHTML = html;
  }

  /**
   * Render cards with stack effect
   * Active card is fully visible, next 1-2 cards are slightly offset and faded
   */
  renderCards() {
    this.els.cardContainer.innerHTML = '';

    for (let i = 0; i < Math.min(3, this.cards.length - this.cardIndex); i++) {
      const cardData = this.cards[this.cardIndex + i];
      if (!cardData) break;

      const card = document.createElement('div');
      card.className = 'card';

      if (i === 0) {
        card.classList.add('card--active');
      } else if (i === 1) {
        card.classList.add('card--next-1');
      } else if (i === 2) {
        card.classList.add('card--next-2');
      }

      card.innerHTML = cardData.html;
      this.els.cardContainer.appendChild(card);
    }
  }

  /**
   * Update navigation status and button states
   */
  updateStatus() {
    const current = this.cardIndex + 1;
    const total = this.cards.length;
    const title = this.metadata.title || 'Session';
    const sessionNum = this.sessionId ? this.sessionId.replace('session-', '') : '?';

    this.els.status.textContent = `Session ${sessionNum} · Card ${current} / ${total}`;

    // Update button disabled states
    this.els.prevBtn.disabled = this.cardIndex === 0;
    this.els.nextBtn.disabled = this.cardIndex >= this.cards.length - 1;
  }

  /**
   * Navigate to a specific card and update the URL hash
   */
  navigateToCard(index) {
    index = Math.max(0, Math.min(index, this.cards.length - 1));
    this.cardIndex = index;
    window.history.replaceState(null, '', `#${this.sessionId}/${index}`);
    this.render();
  }

  /**
   * Show error message in the card container
   */
  showError(message) {
    const card = document.createElement('div');
    card.className = 'card card--active';
    card.innerHTML = `
      <h2>Error Loading Session</h2>
      <p>${this.escapeHtml(message)}</p>
      <p><a href="index.html">← Back to home</a></p>
    `;
    this.els.cardContainer.innerHTML = '';
    this.els.cardContainer.appendChild(card);
  }

  /**
   * Set up event listeners for navigation
   */
  setupListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Button navigation
    this.els.prevBtn.addEventListener('click', () => this.navigateToCard(this.cardIndex - 1));
    this.els.nextBtn.addEventListener('click', () => this.navigateToCard(this.cardIndex + 1));

    // Mouse/touch navigation (click areas)
    this.els.cardContainer.addEventListener('click', (e) => this.handleClickNavigation(e));

    // Hash change navigation
    window.addEventListener('hashchange', () => {
      const oldSessionId = this.sessionId;
      this.parseHash();

      if (this.sessionId !== oldSessionId) {
        // Session changed, reload everything
        this.init();
      } else {
        // Only card changed, just update rendering
        this.render();
      }
    });
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboard(event) {
    switch (event.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        event.preventDefault();
        this.navigateToCard(this.cardIndex + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        this.navigateToCard(this.cardIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.navigateToCard(0);
        break;
      case 'End':
        event.preventDefault();
        this.navigateToCard(this.cards.length - 1);
        break;
    }
  }

  /**
   * Handle click-based navigation
   * Left 30% = previous, Right 70% = next
   */
  handleClickNavigation(event) {
    if (event.target.closest('a, button')) return; // Don't navigate on links/buttons

    const rect = this.els.cardContainer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const threshold = rect.width * 0.3;

    if (x < threshold) {
      this.navigateToCard(this.cardIndex - 1);
    } else {
      this.navigateToCard(this.cardIndex + 1);
    }
  }

  /**
   * HTML escape utility
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

/**
 * Initialize the viewer when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  new SessionViewer();
});
