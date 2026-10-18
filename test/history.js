const assert = require("assert");
const History = require("../out/lib/history");

describe("History", function () {
    it("should store new snapshots and reject duplicates without clearing redo", function () {
        const history = new History();
        assert.strictEqual(history.track("first"), true);
        assert.strictEqual(history.track("second"), true);
        assert.strictEqual(history.undo(), "first");
        assert.strictEqual(history.track("first"), false);
        assert.strictEqual(history.canRedo(), true);
        assert.strictEqual(history.redo(), "second");
        assert.strictEqual(history.past.length, 1);
    });

    it("should reject snapshots while paused", function () {
        const history = new History();
        history.pause();
        assert.strictEqual(history.track("first"), false);
        assert.strictEqual(history.present, null);
        history.unpause();
        assert.strictEqual(history.track("first"), true);
    });
});
