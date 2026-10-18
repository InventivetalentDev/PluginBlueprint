import deepEqual = require('deep-equal');

/**
 * Class to handle undo/redo actions
 * @constructor
 */
class History<T = unknown> {
    declare present: T | null | undefined;
    declare past: (T | null | undefined)[];
    declare future: (T | null | undefined)[];
    declare paused: boolean;

    constructor() {
        this.present = null;
        this.past = [];
        this.future = [];
        this.paused = false;
    }

    /**
     * Tracks a new state to the present and stores any previous actions in the past (doesn't track if the state is equal to the current present)
     * @param state present state
     */
    track(state: T): boolean {
        if (this.paused) return false;
        if (this.present) {
            if (deepEqual(this.present, state)) return false;
            // Move existing present to past
            this.past.push(this.present);
        }
        // Reset future
        this.future.splice(0, this.future.length);

        this.present = state;
        return true;
    }

    pause() {
        this.paused = true;
    }
    unpause() {
        this.paused = false;
    }

    /**
     * Undo and go back to the latest state of the past
     * @returns {*} the last past step
     */
    undo() {
        let previous = this.past.pop();
        this.future.unshift(this.present);
        this.present = previous;
        return previous;
    }

    canUndo() {
        return this.past.length > 0;
    }

    /**
     * Redo and go the first step of the future
     * @returns {*} the first future step
     */
    redo() {
        let next = this.future.shift();
        this.past.push(this.present);
        this.present = next;
        return next;
    }

    canRedo() {
        return this.future.length > 0;
    }

}

export = History;
