const deepEqual = require('deep-equal')

/**
 * Class to handle undo/redo actions
 * @constructor
 */
function History() {
    this.present = null;
    this.past = [];
    this.future = [];
    this.paused = false;
}

/**
 * Tracks a new state to the present and stores any previous actions in the past (doesn't track if the state is equal to the current present)
 * @param state present state
 */
History.prototype.track = function (state) {
    if (this.paused) return;
    if (this.present) {
        if (deepEqual(this.present, state)) return false;
        // Move existing present to past
        this.past.push(this.present);
    }
    // Reset future
    this.future.splice(0, this.future.length);

    this.present = state;
    return true;
};

History.prototype.pause = function () {
    this.paused = true;
};
History.prototype.unpause = function () {
    this.paused = false;
};

/**
 * Undo and go back to the latest state of the past
 * @returns {*} the last past step
 */
History.prototype.undo = function () {
    let previous = this.past.pop();
    this.future.unshift(this.present);
    this.present = previous;
    return previous;
};

History.prototype.canUndo = function () {
    return this.past.length > 0;
};

/**
 * Redo and go the first step of the future
 * @returns {*} the first future step
 */
History.prototype.redo = function () {
    let next = this.future.shift();
    this.past.push(this.present);
    this.present = next;
    return next;
};

History.prototype.canRedo = function () {
    return this.future.length > 0;
};

module.exports = History;