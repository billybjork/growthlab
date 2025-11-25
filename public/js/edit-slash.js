/**
 * Edit Slash Command Module
 * Handles slash command menu for inserting blocks
 */
window.EditSlash = (function() {
    'use strict';

    // ========== CONFIGURATION ==========

    const CONFIG = {
        MENU_WIDTH: 240
    };

    const COMMANDS = [
        { id: 'text', label: 'Text', icon: '📝', description: 'Add a text block' },
        { id: 'image', label: 'Image', icon: '📷', description: 'Add an image' },
        { id: 'video', label: 'Video', icon: '🎥', description: 'Add a video' },
        { id: 'details', label: 'Collapsible', icon: '↕️', description: 'Add a collapsible section' },
        { id: 'callout', label: 'Callout', icon: '💡', description: 'Add a callout box' }
    ];

    // ========== STATE ==========

    let menuElement = null;
    let isActive = false;
    let triggeredFromTextarea = false;
    let query = '';
    let selectedIndex = 0;
    let onExecuteCallback = null;
    let activeTextareaIndex = null;

    // ========== MENU CREATION ==========

    /**
     * Create the slash command menu element if it doesn't exist
     * @returns {HTMLElement}
     */
    function createMenu() {
        if (menuElement) return menuElement;

        const menu = document.createElement('div');
        menu.className = 'slash-command-menu';
        menu.style.display = 'none';
        document.body.appendChild(menu);
        menuElement = menu;
        return menu;
    }

    /**
     * Position menu relative to an anchor element
     * Handles viewport overflow by positioning above if needed
     * @param {DOMRect} anchorRect
     */
    function positionMenu(anchorRect) {
        if (!menuElement) return;

        menuElement.style.display = 'block';
        menuElement.style.width = `${CONFIG.MENU_WIDTH}px`;
        menuElement.style.left = `${Math.min(anchorRect.left, window.innerWidth - CONFIG.MENU_WIDTH - 20)}px`;

        const menuHeight = menuElement.offsetHeight || 200;
        const spaceBelow = window.innerHeight - anchorRect.bottom - 10;
        const spaceAbove = anchorRect.top - 10;

        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            menuElement.style.top = 'auto';
            menuElement.style.bottom = `${window.innerHeight - anchorRect.top + 5}px`;
            menuElement.style.maxHeight = `${Math.min(300, spaceAbove)}px`;
        } else {
            menuElement.style.top = `${anchorRect.bottom + 5}px`;
            menuElement.style.bottom = 'auto';
            menuElement.style.maxHeight = `${Math.min(300, spaceBelow)}px`;
        }
    }

    // ========== FILTERING ==========

    /**
     * Filter commands based on query string
     * @param {string} queryStr
     * @returns {Array}
     */
    function getFilteredCommands(queryStr) {
        if (!queryStr) return COMMANDS;
        const lowerQuery = queryStr.toLowerCase();
        return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(lowerQuery) ||
            cmd.id.toLowerCase().includes(lowerQuery) ||
            cmd.description.toLowerCase().includes(lowerQuery)
        );
    }

    // ========== RENDERING ==========

    /**
     * Render the menu with filtered commands
     * @param {Array} commands
     * @param {number} selected
     */
    function renderMenu(commands, selected = 0) {
        if (!menuElement) createMenu();

        selectedIndex = Math.max(0, Math.min(selected, commands.length - 1));

        menuElement.innerHTML = commands.map((cmd, index) => {
            const isSelected = index === selectedIndex;
            return `
                <button
                    class="slash-menu-item ${isSelected ? 'selected' : ''}"
                    data-command="${cmd.id}"
                >
                    <span class="slash-menu-icon">${cmd.icon}</span>
                    <span class="slash-menu-label">${cmd.label}</span>
                </button>
            `;
        }).join('');

        // Add click handlers
        menuElement.querySelectorAll('.slash-menu-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                executeCommand(commands[index].id);
            });
        });
    }

    /**
     * Scroll selected item into view
     */
    function scrollSelectedIntoView() {
        if (!menuElement) return;
        const selected = menuElement.querySelector('.slash-menu-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // ========== SHOW/HIDE ==========

    /**
     * Show the slash command menu triggered by typing "/" in textarea
     * @param {HTMLTextAreaElement} textarea
     * @param {number} textareaIndex
     */
    function showFromTextarea(textarea, textareaIndex) {
        if (!menuElement) createMenu();

        isActive = true;
        triggeredFromTextarea = true;
        query = '';
        selectedIndex = 0;
        activeTextareaIndex = textareaIndex;

        renderMenu(COMMANDS, 0);
        positionMenu(textarea.getBoundingClientRect());
    }

    /**
     * Show the slash command menu from "Add Block" button
     * @param {DOMRect} anchorRect
     * @param {number} insertIndex
     */
    function showFromButton(anchorRect, insertIndex) {
        if (!menuElement) createMenu();

        isActive = true;
        triggeredFromTextarea = false;
        query = '';
        selectedIndex = 0;
        activeTextareaIndex = insertIndex;

        renderMenu(COMMANDS, 0);
        positionMenu(anchorRect);
    }

    /**
     * Hide the slash command menu
     */
    function hide() {
        if (menuElement) {
            menuElement.style.display = 'none';
        }
        isActive = false;
        triggeredFromTextarea = false;
        query = '';
        selectedIndex = 0;
    }

    // ========== COMMAND EXECUTION ==========

    /**
     * Execute a slash command
     * @param {string} commandId
     */
    function executeCommand(commandId) {
        const insertIndex = activeTextareaIndex !== null ? activeTextareaIndex : 0;

        // Clean up "/" from textarea if triggered from typing
        if (triggeredFromTextarea && activeTextareaIndex !== null) {
            const textarea = document.querySelector(
                `.block-wrapper[data-block-index="${activeTextareaIndex}"] .block-textarea`
            );
            if (textarea) {
                const cursorPos = textarea.selectionStart;
                const text = textarea.value;
                const slashIndex = text.lastIndexOf('/', cursorPos);
                if (slashIndex !== -1) {
                    const newText = text.substring(0, slashIndex) + text.substring(cursorPos);
                    textarea.value = newText;
                    // Notify callback to update block content
                    if (onExecuteCallback) {
                        onExecuteCallback('updateContent', {
                            index: activeTextareaIndex,
                            content: newText
                        });
                    }
                }
            }
        }

        hide();

        // Execute the command via callback
        if (onExecuteCallback) {
            onExecuteCallback('execute', {
                commandId,
                insertIndex
            });
        }
    }

    // ========== KEYBOARD HANDLING ==========

    /**
     * Handle keydown events when menu is active
     * @param {KeyboardEvent} e
     * @returns {boolean} - True if event was handled
     */
    function handleKeydown(e) {
        if (!isActive) return false;

        const filteredCommands = getFilteredCommands(query);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                selectedIndex = (selectedIndex + 1) % filteredCommands.length;
                renderMenu(filteredCommands, selectedIndex);
                scrollSelectedIntoView();
                return true;

            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
                renderMenu(filteredCommands, selectedIndex);
                scrollSelectedIntoView();
                return true;

            case 'Enter':
            case 'Tab':
                e.preventDefault();
                e.stopPropagation();
                if (filteredCommands.length > 0) {
                    executeCommand(filteredCommands[selectedIndex].id);
                }
                return true;

            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                hide();
                return true;
        }
        return false;
    }

    /**
     * Handle textarea input to detect "/" and filter commands
     * @param {HTMLTextAreaElement} textarea
     * @param {number} textareaIndex
     */
    function handleTextareaInput(textarea, textareaIndex) {
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;
        const textBeforeCursor = text.substring(0, cursorPos);

        // Check if "/" was typed at start of line
        const lastNewline = textBeforeCursor.lastIndexOf('\n');
        const lineStart = lastNewline + 1;
        const lineBeforeCursor = textBeforeCursor.substring(lineStart);

        if (lineBeforeCursor === '/') {
            showFromTextarea(textarea, textareaIndex);
            return;
        }

        // If slash command is active, update query
        if (isActive) {
            const slashIndex = textBeforeCursor.lastIndexOf('/');
            if (slashIndex !== -1) {
                const beforeSlash = textBeforeCursor.substring(0, slashIndex);
                const isAtLineStart = beforeSlash === '' || beforeSlash.endsWith('\n');
                if (isAtLineStart) {
                    query = textBeforeCursor.substring(slashIndex + 1);
                    const filteredCommands = getFilteredCommands(query);
                    if (filteredCommands.length === 0) {
                        hide();
                    } else {
                        renderMenu(filteredCommands, 0);
                    }
                } else {
                    hide();
                }
            } else {
                hide();
            }
        }
    }

    // ========== INITIALIZATION ==========

    /**
     * Initialize the slash command system
     * @param {Function} callback - Called with (action, data) when commands execute
     */
    function init(callback) {
        onExecuteCallback = callback;
        createMenu();
    }

    /**
     * Cleanup and destroy the menu
     */
    function cleanup() {
        if (menuElement) {
            menuElement.remove();
            menuElement = null;
        }
        isActive = false;
        onExecuteCallback = null;
    }

    // ========== PUBLIC API ==========

    return {
        // Initialization
        init,
        cleanup,

        // Show/Hide
        showFromTextarea,
        showFromButton,
        hide,

        // Event handlers
        handleKeydown,
        handleTextareaInput,

        // State accessors
        isActive: () => isActive,
        getActiveIndex: () => activeTextareaIndex,

        // Config
        COMMANDS
    };
})();
