let assert = require('assert');
let fs = require("fs-extra");
let os = require("os");
let path = require("path");
const {createLineSplitter, copyPlugin} = require("../out/lib/serverStarter");

describe("ServerStarter", function () {
    describe("#createLineSplitter", function () {
        it("should keep unfinished lines between chunks", function () {
            let lines = [];
            let split = createLineSplitter(line => lines.push(line));
            split("pb_debug_");
            assert.deepEqual(lines, []);
            split("exec=42\nnext");
            assert.deepEqual(lines, ["pb_debug_exec=42"]);
            split(" line\n");
            assert.deepEqual(lines, ["pb_debug_exec=42", "next line"]);
        });

        it("should emit several lines from one chunk", function () {
            let lines = [];
            let split = createLineSplitter(line => lines.push(line));
            split(Buffer.from("first\n\nsecond\nthird\n"));
            split.flush();
            assert.deepEqual(lines, ["first", "", "second", "third"]);
        });

        it("should strip carriage returns from CRLF endings", function () {
            let lines = [];
            let split = createLineSplitter(line => lines.push(line));
            split("first\r");
            split("\nsecond\r\n");
            assert.deepEqual(lines, ["first", "second"]);
        });

        it("should flush a final line without a newline only once", function () {
            let lines = [];
            let split = createLineSplitter(line => lines.push(line));
            split("last line\r");
            assert.deepEqual(lines, []);
            split.flush();
            split.flush();
            assert.deepEqual(lines, ["last line"]);
        });
    });

    describe("#copyPlugin", function () {
        let projectPath;

        beforeEach(async function () {
            projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "pluginblueprint-server-"));
            await fs.outputFile(path.join(projectPath, "output", "Test.jar"), "new plugin");
        });

        afterEach(async function () {
            await fs.remove(projectPath);
        });

        it("should replace the project jar and preserve other plugins and their data", async function () {
            let pluginsDir = path.join(projectPath, "lib", "plugins");
            await fs.outputFile(path.join(pluginsDir, "Test.jar"), "old plugin");
            await fs.outputFile(path.join(pluginsDir, "Other.jar"), "other plugin");
            await fs.outputFile(path.join(pluginsDir, "Other", "config.yml"), "enabled: true\n");

            await copyPlugin(projectPath, {name: "Test"});

            assert.equal(await fs.readFile(path.join(pluginsDir, "Test.jar"), "utf-8"), "new plugin");
            assert.equal(await fs.readFile(path.join(pluginsDir, "Other.jar"), "utf-8"), "other plugin");
            assert.equal(await fs.readFile(path.join(pluginsDir, "Other", "config.yml"), "utf-8"), "enabled: true\n");
        });

        it("should create the plugins directory when it is missing", async function () {
            let pluginsDir = path.join(projectPath, "lib", "plugins");
            assert.equal(await fs.pathExists(pluginsDir), false);

            await copyPlugin(projectPath, {name: "Test"});

            assert.equal(await fs.readFile(path.join(pluginsDir, "Test.jar"), "utf-8"), "new plugin");
        });
    });
});
