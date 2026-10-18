let assert = require('assert');
let fs = require("fs-extra");
let os = require("os");
let path = require("path");
const {createLineSplitter, copyPlugin} = require("../out/lib/serverStarter");
const serverStarter = require("../out/lib/serverStarter");
const childProcess = require("child_process");
const {EventEmitter} = require("events");

describe("ServerStarter", function () {
    describe("server state", function () {
        let originalSpawn, server, spawnArgs;
        beforeEach(function () {
            originalSpawn = childProcess.spawn;
            server = new EventEmitter();
            server.stdout = new EventEmitter();
            server.stderr = new EventEmitter();
            server.stdin = {write: command => {
                assert.strictEqual(command, "stop\n");
                process.nextTick(() => server.emit("exit", 0));
            }};
            childProcess.spawn = (...args) => { spawnArgs = args; return server; };
        });
        afterEach(function () {
            if (serverStarter.isRunning()) server.emit("exit", 0);
            childProcess.spawn = originalSpawn;
        });

        it("should report start and exit, and wait for a normal stop", async function () {
            let states = [];
            assert.strictEqual(serverStarter.startServer("/project", "java", true, undefined, undefined, value => states.push(value)), true);
            assert.strictEqual(serverStarter.startServer("/project", "java", true), false);
            assert.ok(spawnArgs[1].includes("-Dcom.mojang.eula.agree=true"));
            assert.ok(spawnArgs[1].includes("-Dpluginblueprint.debug=true"));
            server.emit("spawn");
            assert.deepStrictEqual(states, [true]);
            let stopping = serverStarter.stopServer();
            assert.strictEqual(serverStarter.stopServer(), stopping);
            await stopping;
            assert.deepStrictEqual(states, [true, false]);
            assert.strictEqual(serverStarter.isRunning(), false);
        });

        it("should report a failed start as stopped", function () {
            let states = [], errors = [];
            serverStarter.startServer("/project", "java", false, undefined, error => errors.push(error), value => states.push(value));
            server.emit("error", {message: "Java unavailable"});
            assert.deepStrictEqual(states, [false]);
            assert.deepStrictEqual(errors, ["Java unavailable"]);
            assert.strictEqual(serverStarter.isRunning(), false);
        });
    });

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
