const assert = require("assert");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const {spawnSync} = require("child_process");
const {parseJavacErrors, nodeForLine, explainJavacError, formatJavacErrors} = require("../out/lib/javacErrors");
const {compile} = require("../out/lib/javaCompiler");
const error = (message, detail = []) => ({file: "GeneratedPlugin.java", line: 78, message, detail});
const incompatible = "incompatible types: org.bukkit.entity.Player cannot be converted to org.bukkit.plugin.PluginDescriptionFile";

describe("JavacErrors", function () {
    it("parses javac source, caret, symbol, and location lines, ignoring notes and warnings", function () {
        const output = "/tmp/GeneratedPlugin.java:78: error: incompatible types: Player cannot be converted to PluginDescriptionFile\n node_3 = node_8_output_2;\n          ^\n/tmp/GeneratedPlugin.java:94: error: cannot find symbol\n node_9_exec();\n ^\n  symbol:   method node_9_exec()\n  location: class GeneratedPlugin\n/tmp/MyHelper.java:2: warning: unchecked conversion\n  warning detail\nNote: Some input files use unchecked or unsafe operations.\n2 errors\n1 warning\n";
        const errors = parseJavacErrors(output.replaceAll("\n", "\r\n"));
        assert.strictEqual(errors.length, 2);
        assert.deepStrictEqual(errors[0], {file: "/tmp/GeneratedPlugin.java", line: 78, message: "incompatible types: Player cannot be converted to PluginDescriptionFile", detail: [" node_3 = node_8_output_2;", "          ^"]});
        assert.deepStrictEqual(errors[1].detail, [" node_9_exec();", " ^", "  symbol:   method node_9_exec()", "  location: class GeneratedPlugin"]);
        assert.deepStrictEqual(parseJavacErrors("Note: nothing\n1 warning\n"), []);
        assert.strictEqual(parseJavacErrors("C:\\project space\\GeneratedPlugin.java:7: error: cannot find symbol")[0].line, 7);
    });
    for (const [snapshot, text, node] of [["variables", "greeting =  node_4_output_0;", 3], ["type-variable", "node_5_output_1 = node_4.get", 5], ["java-code", 'greeting = "Hi " + player.getName();', 3]]) {
        it("maps " + snapshot + " to the enclosing node rather than the source node", function () {
            const source = fs.readFileSync(path.join(__dirname, "snapshots/codegen", snapshot + ".java"), "utf8");
            const line = source.split("\n").findIndex(line => line.includes(text)) + 1;
            assert(line > 0);
            assert.strictEqual(nodeForLine(source, line), node);
            assert.strictEqual(nodeForLine(source.replace(/^if \(PB_DEBUG\).*\n/gm, ""), source.replace(/^if \(PB_DEBUG\).*\n/gm, "").split("\n").findIndex(line => line.includes(text)) + 1), node);
        });
    }
    for (const [source, line, node] of [
        ["private T node_8_output_1;", 1, 8],
        ["public void onEnable() {\nnode_9_exec();\n}", 2, 9],
        ["public void onEnable() {\nunknown();\n}", 2, undefined],
        ["private void node_5_exec() {\nunknown();\n}", 2, 5],
        ["public synchronized void on7(Event event) {\nunknown();\n}", 2, 7],
        ["private void node_6_in_2(String value) {\nunknown();\n}", 2, 6],
        ["private void node_3_exec() {\nObject task = new Object() {\npublic void run() {\nunknown();\n}\n};\n}", 4, undefined],
        ["private void node_3_exec() {\nif (true) {\n}\nunknown();\n}", 4, 3],
        ['if (PB_DEBUG) getLogger().info("pb_debug_exec=12");\nunknown();', 2, 12],
        ["public void on2(Event event) {\n}\nprivate int node_8_output_1;", 3, 8],
        ["public void on2(Event event) {\n}\nprivate int bad;", 3, undefined]
    ]) {
        it("maps source line " + JSON.stringify(source) + " to " + node, function () {
            assert.strictEqual(nodeForLine(source, line), node);
        });
    }
    it("ignores line numbers outside the file", function () {
        assert.strictEqual(nodeForLine("private void node_1_exec() {", 0), undefined);
        assert.strictEqual(nodeForLine("private void node_1_exec() {", 2), undefined);
    });
    for (const [message, detail, explanation] of [
        [incompatible, [], "You plugged a Player into a slot that needs a PluginDescriptionFile."],
        ["cannot find symbol", ["  symbol: method node_9_exec()"], "A node isn't generated because it's missing a connection, usually its REF input."],
        ["cannot find symbol", ["  symbol: class T"], "The code uses class T, which doesn't exist. A node is probably missing a connection."],
        ["variable count is already defined in class GeneratedPlugin", [], "Two variables are named count. Rename one, or give them the same type."],
        ["unreported exception java.io.IOException; must be caught or declared to be thrown", [], "This method can fail with IOException, and PluginBlueprint can't catch exceptions yet. Use a method that doesn't throw it."],
        ["reference to sendMessage is ambiguous", [], "Several versions of sendMessage fit these inputs. Connect inputs with more specific types."],
        ...["<identifier> expected", "';' expected", "illegal start of expression"].map(message => [message, [], "A name or value on this node isn't valid Java. Check its names and text."]),
        ["method sendMessage in class CommandSender cannot be applied to given types;", [], "sendMessage got the wrong number or kind of inputs."],
        ["bad operand types for binary operator '+'", [], "bad operand types for binary operator '+'"]
    ]) {
        it("explains " + message, function () { assert.strictEqual(explainJavacError(error(message, detail)), explanation); });
    }
    it("formats the exact error-window block and leaves user sources without node links", function () {
        const source = [...Array(76).fill(""), "private void node_3_exec() {", "node_8_output_2;", "}"].join("\n");
        const expected = "Line 78 (node_3): You plugged a Player into a slot that needs a PluginDescriptionFile.\n    javac: " + incompatible;
        assert.strictEqual(formatJavacErrors([error(incompatible)], new Map([["GeneratedPlugin.java", source]])), expected);
        const user = {...error(incompatible), file: "/tmp/MyHelper.java", line: 12};
        assert.strictEqual(formatJavacErrors([user], new Map([[user.file, source]])), "MyHelper.java line 12: You plugged a Player into a slot that needs a PluginDescriptionFile.\n    javac: " + incompatible);
        assert(!formatJavacErrors([error(incompatible)], new Map()).includes("(node_"));
    });
    it("compiles with English diagnostics and rejects with explained errors plus raw output", async function () {
        this.timeout(30000);
        if (spawnSync("javac", ["-version"]).error) this.skip();
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pb-javac-errors-"));
        const originalError = console.error;
        try {
            await fs.ensureDir(path.join(dir, "lib"));
            const source = "class GeneratedPlugin {\nprivate void node_3_exec() {\nString value = Integer.valueOf(1);\n}\nprivate void node_8_exec() {\nmissing();\n}\n}";
            await fs.outputFile(path.join(dir, "src", "GeneratedPlugin.java"), source);
            console.error = () => {};
            await assert.rejects(compile(dir, {package: ""}, {javac: "javac"}, 17, []), err => {
                assert.strictEqual(err.code, 1);
                assert.match(err.message, /^Line 3 \(node_3\): You plugged a Integer into a slot that needs a String\./);
                assert.match(err.message, /Line 6 \(node_8\): The code uses method missing\(\)/);
                assert.match(err.message, /\n\njavac output:\n[\s\S]*GeneratedPlugin.java:3: error:/);
                assert.strictEqual(parseJavacErrors(err.message.split("javac output:\n")[1]).length, 2);
                return true;
            });
            const args = await fs.readFile(path.join(dir, "lib", "javac.args"), "utf8");
            assert(!args.includes("-J"));
        } finally {
            console.error = originalError;
            await fs.remove(dir);
        }
    });
});
