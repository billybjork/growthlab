/**
 * Edit Undo Module
 * Manages undo/redo history for the block editor using snapshot-based approach
 */
window.EditUndo = (function() {
    'use strict';

    // ========== CONFIGURATION ==========

    const MAX_STACK_SIZE = 50;
    const TEXT_DEBOUNCE_MS = 500;

    // ========== STATE ==========

    let undoStack = [];
    let redoStack = [];

    // Debounce state for text changes
    let pendingTextSnapshot = null;
    let textDebounceTimer = null;

    // ========== UTILITIES ==========

    /**
     * Deep clone blocks array using JSON serialization
     * @param {Array} blocks
     * @returns {Array}
     */
    function deepClone(blocks) {
        return JSON.parse(JSON.stringify(blocks));
    }

    // ========== CORE FUNCTIONS ==========

    /**
     * Initialize/reset the undo system
     */
    function init() {
        undoStack = [];
        redoStack = [];
        pendingTextSnapshot = null;
        if (textDebounceTimer) {
            clearTimeout(textDebounceTimer);
            textDebounceTimer = null;
        }
    }

    /**
     * Flush any pending text snapshot to the undo stack
     */
    function flushPendingSnapshot() {
        if (pendingTextSnapshot) {
            redoStack = [];
            undoStack.push({
                blocks: pendingTextSnapshot,
                description: 'text edit'
            });
            if (undoStack.length > MAX_STACK_SIZE) {
                undoStack.shift();
            }
            pendingTextSnapshot = null;
        }
        if (textDebounceTimer) {
            clearTimeout(textDebounceTimer);
            textDebounceTimer = null;
        }
    }

    /**
     * Save current state to undo stack (for discrete operations)
     * @param {Array} blocks - Current blocks array
     * @param {string} description - Description of the operation
     */
    function saveState(blocks, description = '') {
        // Flush any pending text snapshot first
        flushPendingSnapshot();

        // Clear redo stack on new action
        redoStack = [];

        // Push to undo stack
        undoStack.push({
            blocks: deepClone(blocks),
            description
        });

        // Limit stack size
        if (undoStack.length > MAX_STACK_SIZE) {
            undoStack.shift();
        }
    }

    /**
     * Save state for text changes (debounced to group keystrokes)
     * @param {Array} blocks - Current blocks array
     */
    function saveTextChange(blocks) {
        // Capture snapshot on first change in this typing session
        if (!pendingTextSnapshot) {
            pendingTextSnapshot = deepClone(blocks);
        }

        // Reset debounce timer
        if (textDebounceTimer) {
            clearTimeout(textDebounceTimer);
        }
        textDebounceTimer = setTimeout(() => {
            flushPendingSnapshot();
        }, TEXT_DEBOUNCE_MS);
    }

    /**
     * Undo last operation
     * @param {Array} currentBlocks - Current blocks array
     * @returns {Array|null} - Previous state or null if nothing to undo
     */
    function undo(currentBlocks) {
        // Flush any pending text changes first
        flushPendingSnapshot();

        if (undoStack.length === 0) {
            return null;
        }

        const state = undoStack.pop();

        // Save current state to redo stack
        redoStack.push({
            blocks: deepClone(currentBlocks),
            description: 'undo'
        });

        return state.blocks;
    }

    /**
     * Redo last undone operation
     * @param {Array} currentBlocks - Current blocks array
     * @returns {Array|null} - Next state or null if nothing to redo
     */
    function redo(currentBlocks) {
        if (redoStack.length === 0) {
            return null;
        }

        const state = redoStack.pop();

        // Save current state to undo stack
        undoStack.push({
            blocks: deepClone(currentBlocks),
            description: 'redo'
        });

        return state.blocks;
    }

    // ========== PUBLIC API ==========

    return {
        init,
        saveState,
        saveTextChange,
        flushPendingSnapshot,
        undo,
        redo,
        canUndo: () => undoStack.length > 0 || pendingTextSnapshot !== null,
        canRedo: () => redoStack.length > 0,
        clear: init
    };
})();
