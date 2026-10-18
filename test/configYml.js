const assert = require("assert");
const {makeConfigYml} = require("../out/lib/configYml");

describe("ConfigYml", function () {
    it("keeps parent positions and nested entries in table order", function () {
        assert.strictEqual(makeConfigYml([
            {key: "welcome.message", type: "string", default: 'Hello "player"\nWelcome!'},
            {key: "enabled", type: "boolean", default: "TRUE"},
            {key: "welcome.sound.volume", type: "double", default: "1.5"},
            {key: "welcome.count", type: "int", default: "-2"}
        ]), '"welcome":\n  "message": "Hello \\"player\\"\\nWelcome!"\n  "sound":\n    "volume": 1.5\n  "count": -2\n"enabled": true\n');
    });
    it("emits every type and falls back for invalid numbers", function () {
        const entries = [
            ["integer", "int", "42", "42"], ["badInt", "int", "1.5", "0"], ["emptyInt", "int", "", "0"],
            ["double", "double", "-2.5e2", "-2.5e2"], ["badDouble", "double", "no", "0.0"],
            ["infinite", "double", "Infinity", "0.0"], ["emptyDouble", "double", "", "0.0"],
            ["yes", "boolean", "tRuE", "true"], ["no", "boolean", "yes", "false"],
            ["list", "list", ' a, , b "c", ', '\n  - "a"\n  - "b \\"c\\""'],
            ["emptyList", "list", " , ", "[]"], ["string", "string", "true: #text", '"true: #text"']
        ];
        for (const [key, type, value, expected] of entries) {
            assert.strictEqual(makeConfigYml([{key, type, default: value}]), JSON.stringify(key) + ":" + (expected.startsWith("\n") ? "" : " ") + expected + "\n");
        }
    });
    it("rejects invalid key segments with the key in the message", function () {
        for (const key of ["", ".a", "a.", "a..b", "a b", "a:b", "a/b"]) {
            assert.throws(() => makeConfigYml([{key, type: "string", default: ""}]), {
                message: 'Config key "' + key + '" can only use letters, digits, - and _ between dots.'
            });
        }
    });
    it("rejects duplicate keys and value/parent clashes in either order", function () {
        for (const [first, second] of [["a", "a"], ["a", "a.b"], ["a.b", "a"], ["a.b", "a.b.c"]]) {
            assert.throws(() => makeConfigYml([first, second].map(key => ({key, type: "int", default: "1"}))), {
                message: 'Config key "' + second + '" clashes with "' + first + '".'
            });
        }
    });
    it("quotes numeric and YAML keyword keys and handles object property names", function () {
        assert.strictEqual(makeConfigYml(["true", "null", "123", "__proto__.constructor"].map(key => ({key, type: "string", default: "value"}))),
            '"true": "value"\n"null": "value"\n"123": "value"\n"__proto__":\n  "constructor": "value"\n');
    });
    it("emits nothing for an empty table", function () {
        assert.strictEqual(makeConfigYml([]), "");
    });
});
