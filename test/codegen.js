const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {spawnSync} = require("child_process");
const H = require("./support/harness");
const ClassDataStore = require("../out/lib/classDataStore");
const {getClasspath} = require("../out/lib/paper");
const {SourceError, pickNodeKeys} = require("../out/lib/sourceChecks");
const classStore = new ClassDataStore();
const snapshotDir = path.join(__dirname, "snapshots/codegen");
const cases = {};

cases["java-code"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const code = H.add(graph, "code/JavaCode", {
        codeInputs: [{name: "player", type: "org.bukkit.entity.Player"}],
        codeOutputs: [{name: "greeting", type: "java.lang.String"}],
        code: 'greeting = "Hi " + player.getName();'
    });
    code.onConfigure();
    const log = H.add(graph, "native/ConsoleLog");
    H.link(event, "EXEC", code, "EXEC");
    H.link(event, H.addOptOut(event, "getPlayer"), code, "player");
    H.link(code, "EXEC", log, "EXEC");
    H.link(code, "greeting", log, 1);
};

for (const name of ["join-message", "hello-command", "block-protect", "timed-broadcast", "starter-kit"]) {
    cases[name] = graph => H.loadSnippet(graph, JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/examples", name + ".pbs"), "utf8")));
}

cases["javaplugin-method"] = graph => {
    const plugin = H.add(graph, "org.bukkit.plugin.java.JavaPlugin");
    const enable = H.add(graph, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
    H.link(plugin, H.addOptOut(plugin, "onEnable()"), enable, "REF");
    const save = H.add(graph, "org.bukkit.plugin.java.JavaPlugin#saveDefaultConfig()");
    H.link(plugin, H.addOptOut(plugin, "saveDefaultConfig()"), save, "REF");
    H.link(enable, "EXEC", save, "EXEC");
};
cases["checked-exception"] = graph => {
    const plugin = H.add(graph, "org.bukkit.plugin.java.JavaPlugin");
    const disable = H.add(graph, "org.bukkit.plugin.java.JavaPlugin{onDisable()}");
    H.link(plugin, H.addOptOut(plugin, "onDisable()"), disable, "REF");
    const config = H.add(graph, "org.bukkit.configuration.file.FileConfiguration");
    H.link(plugin, H.addOptOut(plugin, "getConfig"), config, "REF");
    H.link(disable, "EXEC", config, "EXEC");
    const save = H.add(graph, "org.bukkit.configuration.file.FileConfiguration#save(java.io.File)");
    H.link(config, H.addOptOut(config, "save(File)"), save, "REF");
    H.link(config, "EXEC", save, "EXEC");
    H.link(plugin, H.addOptOut(plugin, "getDataFolder"), save, "file");
};
cases.variables = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const set = H.add(graph, "variables/Set", {name: "greeting", type: "string"});
    const text = H.add(graph, "constants/StringConstant", {string: "hi"});
    H.link(event, "EXEC", set, "EXEC");
    H.link(text, 0, set, 1);
    const get = H.add(graph, "variables/Get", {name: "greeting", type: "string"});
    const player = H.add(graph, "org.bukkit.entity.Player");
    H.link(event, H.addOptOut(event, "getPlayer"), player, "REF");
    H.link(set, "EXEC", player, "EXEC");
    const send = H.add(graph, "org.bukkit.command.CommandSender#sendMessage(java.lang.String)");
    H.link(player, H.addOptOut(player, "sendMessage(String)"), send, "REF");
    H.link(player, "EXEC", send, "EXEC");
    H.link(get, 0, send, "message");
    const secondSet = H.add(graph, "variables/Set", {name: "greeting", type: "string"});
    H.link(event, "EXEC", secondSet, "EXEC");
    H.link(text, 0, secondSet, 1);
};
cases["type-variable"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const ctor = H.add(graph, "java.util.HashMap#HashMap()");
    const map = H.add(graph, "java.util.Map");
    H.link(event, "EXEC", ctor, "EXEC");
    H.link(ctor, "THIS", map, "REF");
    H.link(ctor, "EXEC", map, "EXEC");
    const get = H.add(graph, "java.util.Map#get(java.lang.Object)");
    H.link(map, H.addOptOut(map, "get(Object)"), get, "REF");
    H.link(map, "EXEC", get, "EXEC");
    const key = H.add(graph, "constants/StringConstant", {string: "x"});
    H.link(key, 0, get, "key");
    const valueOf = H.add(graph, "java.lang.String#valueOf(java.lang.Object)");
    H.link(get, "EXEC", valueOf, "EXEC");
    H.link(get, "RETURN", valueOf, "obj");
};
cases["object-input"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const valueOf = H.add(graph, "java.lang.String#valueOf(java.lang.Object)");
    H.link(event, "EXEC", valueOf, "EXEC");
    H.link(event, H.addOptOut(event, "getPlayer"), valueOf, "obj");
};
cases.tabcomplete = graph => {
    const plugin = H.add(graph, "org.bukkit.plugin.java.JavaPlugin");
    const output = H.addOptOut(plugin, "onTabComplete(CommandSender, Command, String, String[])");
    const tab = H.add(graph, "org.bukkit.plugin.java.JavaPlugin{" + plugin.outputs[output].methodSignature + "}");
    H.link(plugin, output, tab, "REF");
    const list = H.add(graph, "java.util.Collections#emptyList()");
    H.link(tab, "EXEC", list, "EXEC");
    H.link(list, "RETURN", tab, "RETURN");
    const log = H.add(graph, "native/ConsoleLog");
    H.link(list, "EXEC", log, "EXEC");
    H.link(tab, "alias", log, 1);
};
cases["command-return"] = graph => {
    const plugin = H.add(graph, "org.bukkit.plugin.java.JavaPlugin");
    const output = H.addOptOut(plugin, "onCommand(CommandSender, Command, String, String[])");
    const signature = "org.bukkit.plugin.java.JavaPlugin{" + plugin.outputs[output].methodSignature + "}";
    const first = H.add(graph, signature);
    const second = H.add(graph, signature);
    H.link(plugin, output, first, "REF");
    H.link(plugin, output, second, "REF");
    const no = H.add(graph, "constants/BooleanConstant", {value: false});
    const yes = H.add(graph, "constants/BooleanConstant", {value: true});
    H.link(no, 0, first, "RETURN");
    H.link(yes, 0, second, "RETURN");
    graph._nodes.reverse();
};
cases["unconnected-params"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    let previous = event;
    for (const type of ["java.lang.String#valueOf(long)", "java.lang.String#valueOf(float)", "java.lang.String#valueOf(double)", "java.lang.Byte#valueOf(byte)", "java.lang.String#valueOf(java.lang.Object)", "java.util.Arrays#toString(byte[])"]) {
        const method = H.add(graph, type);
        H.link(previous, "EXEC", method, "EXEC");
        previous = method;
    }
    const player = H.add(graph, "org.bukkit.entity.Player");
    H.link(event, H.addOptOut(event, "getPlayer"), player, "REF");
    H.link(previous, "EXEC", player, "EXEC");
    const send = H.add(graph, "org.bukkit.command.CommandSender#sendMessage(net.kyori.adventure.text.Component)");
    H.link(player, H.addOptOut(player, "sendMessage(Component)"), send, "REF");
    H.link(player, "EXEC", send, "EXEC");
};
cases["enum-getter"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const material = H.add(graph, "org.bukkit.Material");
    material.properties.en = "STONE";
    delete material.outputs[0].enumName;
    const log = H.add(graph, "native/ConsoleLog");
    H.link(event, "EXEC", log, "EXEC");
    H.link(material, H.addOptOut(material, "getMaxStackSize"), log, 1);
    const constantLog = H.add(graph, "native/ConsoleLog");
    H.link(event, "EXEC", constantLog, "EXEC");
    H.link(material, 0, constantLog, 1);
};
cases["enum-method"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const material = H.add(graph, "org.bukkit.Material", {en: "STONE"});
    const method = H.add(graph, "org.bukkit.Material#createBlockData(java.lang.String)");
    H.link(event, "EXEC", method, "EXEC");
    H.link(material, H.addOptOut(material, "createBlockData(String)"), method, "REF");
    const data = H.add(graph, "constants/StringConstant", {string: "[waterlogged=true]"});
    H.link(data, 0, method, "data");
};
cases["stringformat-novars"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const format = H.add(graph, "native/StringFormat");
    const text = H.add(graph, "constants/StringConstant", {string: "Welcome!"});
    H.link(event, "EXEC", format, "EXEC");
    H.link(text, 0, format, "Format");
};
cases["switch-nocondition"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    H.link(event, "EXEC", H.add(graph, "flow/Switch"), "EXEC");
};
cases.flipflop = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const flip = H.add(graph, "flow/FlipFlop");
    H.link(event, "EXEC", flip, "EXEC");
    for (const branch of ["A", "B"]) {
        const log = H.add(graph, "native/ConsoleLog");
        const text = H.add(graph, "constants/StringConstant", {string: branch});
        H.link(flip, branch, log, "EXEC");
        H.link(text, 0, log, 1);
    }
    const state = H.add(graph, "native/ConsoleLog");
    H.link(event, "EXEC", state, "EXEC");
    H.link(flip, "isA", state, 1);
};

cases["static-constant"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const player = H.add(graph, "org.bukkit.entity.Player");
    H.link(event, "EXEC", player, "EXEC");
    H.link(event, H.addOptOut(event, "getPlayer"), player, "REF");
    const sound = H.add(graph, "org.bukkit.Sound#static:org.bukkit.Sound", {field: "ENTITY_PLAYER_LEVELUP"});
    const playOutput = H.addOptOut(player, "playSound(Location, Sound, float, float)");
    const play = H.add(graph, player.outputs[playOutput].type);
    H.link(player, playOutput, play, "REF");
    H.link(player, "EXEC", play, "EXEC");
    H.link(player, H.addOptOut(player, "getLocation"), play, "location");
    H.link(sound, 0, play, "sound");
    const volume = H.add(graph, "constants/NumberConstant", {type: "float", number: 1});
    H.link(volume, 0, play, "volume");
    H.link(volume, 0, play, "pitch");
    const attribute = H.add(graph, "org.bukkit.attribute.Attribute#static:org.bukkit.attribute.Attribute", {field: "MAX_HEALTH"});
    const attributeOutput = H.addOptOut(player, "getAttribute(Attribute)");
    const get = H.add(graph, player.outputs[attributeOutput].type);
    H.link(player, attributeOutput, get, "REF");
    H.link(play, "EXEC", get, "EXEC");
    H.link(attribute, 0, get, "attribute");
};
cases["event-options"] = graph => {
    H.add(graph, "org.bukkit.event.block.BlockBreakEvent", {priority: "HIGH", ignoreCancelled: true});
    H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
};
cases["cancel-event"] = graph => {
    const event = H.add(graph, "org.bukkit.event.block.BlockBreakEvent");
    const cancel = H.add(graph, "events/CancelEvent");
    H.link(event, "EXEC", cancel, "EXEC");
    H.link(event, "THIS", cancel, "event");
    H.link(cancel, "EXEC", H.add(graph, "native/ConsoleLog"), "EXEC");
};
cases["note-ignored"] = graph => {
    cases["join-message"](graph);
    H.add(graph, "annotations/Note", {text: "Welcome players\nKeep the greeting short."});
};

function addCommandArgument(node, type, name) {
    const menu = node.getMenuOptions({prompt: (title, value, callback) => callback(name)});
    const entry = menu.find(entry => entry.content === "Add argument");
    const index = ["word", "text", "int", "double", "boolean", "player"].indexOf(type);
    entry.submenu.options[index].callback(null, {}, {});
}

cases["command-basic"] = graph => {
    const command = H.add(graph, "commands/Command", {name: "Hello!", description: "Say hello", aliases: " Hi!, HEY ",
        permission: "MyPlugin.Hello!", permissionMessage: "<red>You need permission to say hello."});
    const sender = H.add(graph, "org.bukkit.command.CommandSender");
    H.link(command, "sender", sender, "REF");
    H.link(command, "EXEC", sender, "EXEC");
    const sendOutput = H.addOptOut(sender, "sendRichMessage(String)");
    const send = H.add(graph, sender.outputs[sendOutput].type);
    H.link(sender, sendOutput, send, "REF");
    H.link(sender, "EXEC", send, "EXEC");
    const text = H.add(graph, "constants/StringConstant", {string: "<green>Hello!"});
    H.link(text, 0, send, "message");
};
cases["command-args"] = graph => {
    const command = H.add(graph, "commands/Command", {name: "greet", description: "Greet a player", playersOnly: true});
    for (const [type, name] of [["word", "greeting"], ["int", "count"], ["player", "target"], ["text", "message"]]) addCommandArgument(command, type, name);
    const player = H.add(graph, "org.bukkit.entity.Player");
    H.link(command, "target", player, "REF");
    H.link(command, "EXEC", player, "EXEC");
    const log = H.add(graph, "native/ConsoleLog");
    H.link(player, "EXEC", log, "EXEC");
    H.link(player, H.addOptOut(player, "getName"), log, 1);
};
cases["command-bare"] = graph => {
    H.add(graph, "commands/Command");
};
const configEntries = [
    {key: "welcome.message", type: "string", default: "Hello, player!"},
    {key: "count", type: "int", default: "3"},
    {key: "amount", type: "double", default: "1.5"},
    {key: "enabled", type: "boolean", default: "true"},
    {key: "names", type: "list", default: "Alex, Steve"}
];
cases["config-values"] = graph => {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    const reload = H.add(graph, "config/ReloadConfig");
    H.link(event, "EXEC", reload, "EXEC");
    for (const entry of configEntries) {
        const value = H.add(graph, "config/ConfigValue", {key: entry.key, type: entry.type});
        const log = H.add(graph, "native/ConsoleLog");
        H.link(reload, "EXEC", log, "EXEC");
        H.link(value, 0, log, 1);
    }
    return {config: configEntries};
};

describe("Codegen", function () {
    this.timeout(30000);
    before(async function () {
        await H.setup();
        await classStore.init();
    });
    for (const [name, build] of Object.entries(cases)) {
        it(name + " matches its snapshot", async function () {
            const graph = await H.setup();
            const projectInfo = build(graph);
            const code = (await H.gen(graph, true, projectInfo)).replace(/\r\n/g, "\n");
            if (name === "note-ignored") assert.strictEqual(code, fs.readFileSync(path.join(snapshotDir, "join-message.java"), "utf8").replace(/\r\n/g, "\n"));
            const file = path.join(snapshotDir, name + ".java");
            if (process.env.UPDATE_SNAPSHOTS === "1") fs.writeFileSync(file, code);
            else assert.strictEqual(code, fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
        });
        const compilable = name !== "checked-exception";
        it(name + (compilable ? " compiles (requires PB_PAPER_LIB)" : " is not compilable: FileConfiguration.save(File) throws IOException"), function () {
            if (!compilable || !process.env.PB_PAPER_LIB) this.skip();
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pb-codegen-"));
            try {
                const source = path.join(dir, "GeneratedPlugin.java");
                fs.copyFileSync(path.join(snapshotDir, name + ".java"), source);
                const args = ["-encoding", "UTF-8", "--release", "25", "-cp", getClasspath(path.resolve(process.env.PB_PAPER_LIB)).join(path.delimiter), "-d", path.join(dir, "classes"), source];
                const argfile = path.join(dir, "javac.args");
                fs.writeFileSync(argfile, args.map(arg => JSON.stringify(arg)).join("\n"));
                const result = spawnSync("javac", ["@" + argfile], {encoding: "utf8"});
                assert.strictEqual(result.status, 0, result.stderr || String(result.error));
            } finally {
                fs.rmSync(dir, {recursive: true, force: true});
            }
        });
    }
    it("rejects generation when a method reference links to a missing node", async function () {
        const graph = await H.setup();
        const send = H.add(graph, "org.bukkit.command.CommandSender#sendMessage(java.lang.String)");
        const slot = H.inIdx(send, "REF");
        send.inputs[slot].link = 1;
        graph.links[1] = new (H.LiteGraph().LLink)(1, send.inputs[slot].type, 999, 0, send.id, slot);
        await assert.rejects(H.gen(graph), TypeError);
    });
    it("rejects a crafted link origin slot with a SourceError on its target node", async function () {
        const graph = await H.setup();
        const value = H.add(graph, "constants/StringConstant");
        const log = H.add(graph, "native/ConsoleLog");
        const link = H.link(value, 0, log, 1);
        link.origin_slot = "0; injected()";
        await assert.rejects(H.gen(graph), error => error instanceof SourceError && error.nodeId === log.id && /connection has an invalid id or slot/.test(error.message));
    });
    it("rejects a string node id with a SourceError without an invalid node id", async function () {
        const graph = await H.setup();
        const node = H.add(graph, "constants/StringConstant");
        node.id = '1"; injected(); //';
        await assert.rejects(H.gen(graph), error => error instanceof SourceError && error.nodeId === undefined && /has an invalid id/.test(error.message));
    });
    for (const [type, property, value] of [
        ["constants/NumberConstant", "number", '0; static { Runtime.getRuntime().exec("injected"); } int x = 0'],
        ["constants/NumberConstant", "type", "int;"],
        ["constants/BooleanConstant", "value", "false;"],
        ["variables/Set", "name", "x;"],
        ["variables/Get", "type", "int;"],
        ["native/Cast", "castTo", "java.lang.Object;"],
        ["native/InstanceOf", "type", "java.lang.Object;"],
        ["arrays/MakeArray", "type", "java.lang.Object;"],
        ["code/JavaCode", "codeInputs", [{name: "player", type: "int x; static {}"}]],
        ["arithmetic/Add", "type", "int;"],
        ["events/CancelEvent", "cancel", "true); injected(); //"],
        ["org.bukkit.Material", "en", "STONE;"],
        ["org.bukkit.Sound#static:org.bukkit.Sound", "field", "ENTITY_PLAYER_LEVELUP;"],
        ["org.bukkit.event.player.PlayerJoinEvent", "priority", "HIGH) injected"],
        ["org.bukkit.event.block.BlockBreakEvent", "ignoreCancelled", "true"]
    ]) {
        it("rejects crafted " + type + "." + property + " with its node id", async function () {
            const graph = await H.setup();
            const node = H.add(graph, type);
            if (type === "events/CancelEvent") H.link(H.add(graph, "org.bukkit.event.block.BlockBreakEvent"), "THIS", node, "event");
            if (type === "org.bukkit.Material") H.link(node, 0, H.add(graph, "native/ConsoleLog"), 1);
            node.properties[property] = value;
            await assert.rejects(H.gen(graph), error => error instanceof SourceError && error.nodeId === node.id);
        });
    }
    for (const sink of ["command", "event", "object", "enum", "enum method"]) {
        it("rejects a crafted " + sink + " slot or enum reference with its node id", async function () {
            const graph = await H.setup();
            if (sink === "enum method") {
                cases["enum-method"](graph);
                const node = graph._nodes.find(node => node.type === "org.bukkit.Material");
                node.properties.en = "STONE;";
                await assert.rejects(H.gen(graph), error => error instanceof SourceError && error.nodeId === node.id);
                return;
            }
            const type = {command: "commands/Command", event: "org.bukkit.event.player.PlayerJoinEvent", object: "org.bukkit.entity.Player", enum: "org.bukkit.Material"}[sink];
            const node = H.add(graph, type);
            const slot = sink === "command" ? 1 : sink === "event" ? H.addOptOut(node, "getPlayer") : sink === "object" ? H.outIdx(node, "THIS") : 0;
            if (sink !== "command") H.link(node, slot, H.add(graph, "native/ConsoleLog"), 1);
            if (sink === "event") node.outputs[slot].linkType = "crafted";
            node.outputs[slot].type = "int x;";
            await assert.rejects(H.gen(graph), error => error instanceof SourceError && error.nodeId === node.id);
        });
    }
    it("rejects a crafted project package", async function () {
        const graph = await H.setup();
        await assert.rejects(H.gen(graph, false, {package: "example; class Injected {}"}), error => error instanceof SourceError && error.nodeId === undefined && error.message === "The package name in Project Information isn't a valid Java package. Use something like me.yourname.myplugin.");
    });
    it("preserves legacy variable type mappings after validating their properties", async function () {
        const graph = await H.setup();
        const node = H.add(graph, "variables/Get", {name: "count"});
        for (const type of [undefined, null, "", "any", "string"]) {
            node.properties.type = type;
            const code = await H.gen(graph);
            assert(code.includes("private java.lang." + (type === "string" ? "String" : "Object") + " count;"));
        }
    });
    for (const loading of ["snippet", "graph"]) {
        it("drops metadata overrides and refreshes constant labels when loading a " + loading, async function () {
            const graph = await H.setup();
            const nodes = [
                H.add(graph, "constants/StringConstant", {string: "saved"}),
                H.add(graph, "constants/NumberConstant", {number: "5", type: "long"}),
                H.add(graph, "constants/BooleanConstant", {value: "true"})
            ].map(node => ({...node.serialize(), className: "Injected", classType: "event", nodeType: "BukkitClassNode", outputs: node.outputs.map(output => ({...output, label: "stale"}))}));
            graph.clear();
            if (loading === "snippet") H.loadSnippet(graph, {nodes, links: [], groups: []});
            else graph.configure({nodes: nodes.map(pickNodeKeys), links: []});
            assert.deepStrictEqual(graph._nodes.map(node => node.outputs[0].label), ["saved", "long 5", "true"]);
            for (const node of graph._nodes) {
                assert.strictEqual(node.classType, "native");
                assert.strictEqual(node.className, undefined);
                assert.strictEqual(node.nodeType, undefined);
            }
            const code = await H.gen(graph);
            assert(code.includes(' = "saved";'));
            assert(code.includes(" = 5L;"));
            assert(code.includes(" = true;"));
        });
    }
    it("keeps Java code declarations and links through adding, removal and serialization", async function () {
        const graph = await H.setup();
        const node = H.add(graph, "code/JavaCode");
        const add = (direction, name, type) => node.addCodeSlot(direction === "input", name, type);
        add("input", "player", "org.bukkit.entity.Player");
        add("output", "greeting", "java.lang.String");
        assert.strictEqual(add("input", "greeting", "int"), -1);
        assert.strictEqual(add("output", "bad name", "int"), -1);
        assert.strictEqual(node.inputs.length, 2);
        assert.strictEqual(node.outputs.length, 2);
        const answer = "greeting = player.getName();";
        node.getMenuOptions({prompt(title, value, callback) { callback(answer); }})[0].callback(null, {}, {});
        assert.strictEqual(node.properties.code, answer);
        const log = H.add(graph, "native/ConsoleLog");
        H.link(node, "greeting", log, 1);
        const saved = graph.serialize();
        saved.nodes.find(saved => saved.id === node.id).outputs[1].name = "stale";
        saved.nodes.find(saved => saved.id === node.id).outputs[1].type = "int";
        graph.configure(saved);
        const restored = graph.getNodeById(node.id);
        assert.strictEqual(restored.outputs[1].name, "greeting");
        assert.strictEqual(restored.outputs[1].label, "greeting");
        assert.strictEqual(restored.outputs[1].type, "java.lang.String");
        assert(restored.outputs[1].links.length === 1 && restored.outputs[1].removable);
        restored.removeInput(1);
        restored.removeOutput(1);
        assert.deepStrictEqual(restored.properties.codeInputs, []);
        assert.deepStrictEqual(restored.properties.codeOutputs, []);
    });
    it("keeps Command arguments and outputs together through menus, removal and serialization", async function () {
        const graph = await H.setup();
        const command = H.add(graph, "commands/Command");
        assert.strictEqual(command.title, "/mycommand");
        assert.deepStrictEqual(command.outputs.map(output => output.name), ["EXEC", "sender", "player", "args"]);
        addCommandArgument(command, "int", "!amount!");
        addCommandArgument(command, "text", "");
        assert.deepStrictEqual(command.properties.arguments, [{name: "amount", type: "int"}, {name: "arg2", type: "text"}]);
        assert(command.outputs.slice(4).every(output => output.removable));
        let menu = command.getMenuOptions({});
        assert.strictEqual(menu.find(entry => entry.content === "Add argument").disabled, true);
        assert(!menu.find(entry => entry.content === "Properties").submenu.options.some(entry => entry.content === "arguments"));
        graph.configure(graph.serialize());
        const restored = graph.getNodeById(command.id);
        assert.deepStrictEqual(restored.properties.arguments, command.properties.arguments);
        assert.deepStrictEqual(restored.outputs.map(output => output.type), ["@EXEC", "org.bukkit.command.CommandSender", "org.bukkit.entity.Player", "java.lang.String[]", "int", "java.lang.String"]);
        restored.removeOutput(5);
        assert.deepStrictEqual(restored.properties.arguments, [{name: "amount", type: "int"}]);
        assert.strictEqual(!!restored.getMenuOptions({}).find(entry => entry.content === "Add argument").disabled, false);
    });
    it("parses doubles and booleans, completes booleans and cleans names again at generation", async function () {
        const graph = await H.setup();
        const command = H.add(graph, "commands/Command");
        addCommandArgument(command, "double", "amount");
        addCommandArgument(command, "boolean", "enabled");
        command.properties.name = "!";
        command.properties.aliases = " YES!, ?? ";
        command.properties.permission = "MyPlugin.USE!";
        const code = await H.gen(graph);
        assert(code.includes('registerCommand("mycommand", "", java.util.List.of("yes"),'));
        assert(code.includes('.hasPermission("myplugin.use")'));
        assert(code.includes("java.lang.Double.parseDouble(args[0])"));
        assert(code.includes('!"true".equalsIgnoreCase(args[1]) && !"false".equalsIgnoreCase(args[1])'));
        assert(code.includes('if (index == 1) return java.util.List.of("true", "false").stream().filter(value -> value.startsWith(prefix)).toList();'));
        assert(!code.includes("Only players can use this command."));
    });
    it("updates Config value types and disconnects changed outputs without caching reads", async function () {
        const graph = await H.setup();
        const value = H.add(graph, "config/ConfigValue");
        assert.deepStrictEqual(value.widgets[0].options.values(), []);
        global.projectInfo = {config: configEntries.map(entry => ({...entry}))};
        try {
            assert.deepStrictEqual(value.widgets[0].options.values(), configEntries.map(entry => entry.key));
            value.widgets[0].callback("welcome.message");
            const log = H.add(graph, "native/ConsoleLog");
            H.link(value, 0, log, 1);
            value.widgets[0].callback("count");
            assert.strictEqual(log.inputs[1].link, null);
            assert.strictEqual(value.properties.type, "int");
            assert.strictEqual(value.outputs[0].type, "int");
            assert.strictEqual(value.outputs[0].label, "count");
            assert.strictEqual(value.getOutputExpression(0), 'getConfig().getInt("count")');
            graph.configure(graph.serialize());
            assert.strictEqual(graph.getNodeById(value.id).widgets[0].value, "count");
            const restored = graph.getNodeById(value.id);
            global.projectInfo.config.find(entry => entry.key === "count").type = "double";
            restored.widgets[0].callback("count");
            assert.strictEqual(restored.outputs[0].type, "double");
            global.projectInfo.config.find(entry => entry.key === "count").type = "int";
            restored.widgets[0].callback("count");
        } finally {
            delete global.projectInfo;
        }
        const restoredValue = graph.getNodeById(value.id);
        const log = graph._nodes.find(node => node.type === "native/ConsoleLog");
        H.link(restoredValue, 0, log, 1);
        graph.configure(graph.serialize());
        assert.notStrictEqual(graph.getNodeById(log.id).inputs[1].link, null);
        assert.strictEqual(graph.getNodeById(value.id).outputs[0].type, "int");
    });
    it("preserves both ends of saved Config value links when the table type changed", async function () {
        const graph = await H.setup();
        global.projectInfo = {config: [{key: "count", type: "string", default: "3"}]};
        try {
            const value = H.add(graph, "config/ConfigValue", {key: "count", type: "int"});
            const add = H.add(graph, "arithmetic/Add");
            const link = H.link(value, 0, add, "A");
            graph.configure(graph.serialize());
            const restoredValue = graph.getNodeById(value.id);
            const restoredAdd = graph.getNodeById(add.id);
            assert.strictEqual(restoredValue.properties.type, "int");
            assert.strictEqual(restoredValue.outputs[0].type, "int");
            assert.deepStrictEqual(restoredValue.outputs[0].links, [link.id]);
            assert.strictEqual(restoredAdd.inputs[H.inIdx(restoredAdd, "A")].link, link.id);
            assert(graph.links[link.id]);
            assert.strictEqual(graph.links[link.id].origin_id, value.id);
            assert.strictEqual(graph.links[link.id].target_id, add.id);
        } finally {
            delete global.projectInfo;
        }
    });
    it("classifies only Bukkit events with a handler list as events", function () {
        assert.strictEqual(classStore.getClass("org.bukkit.event.player.PlayerJoinEvent").isEvent, true);
        assert.strictEqual(classStore.getClass("org.bukkit.event.player.PlayerEvent").isEvent, false);
        assert.strictEqual(classStore.getClass("net.kyori.adventure.text.event.ClickEvent").isEvent, false);
    });
    it("keeps constant dropdowns separate by type and excludes enums and deprecated fields", async function () {
        const graph = await H.setup();
        const sound = H.add(graph, "org.bukkit.Sound#static:org.bukkit.Sound");
        assert.strictEqual(sound.title, "Sound");
        assert.strictEqual((sound.inputs || []).length, 0);
        assert.strictEqual(sound.outputs.length, 1);
        assert.strictEqual(sound.outputs[0].type, "org.bukkit.Sound");
        assert.strictEqual(sound.outputs[0].linkType, "staticField");
        assert.strictEqual(sound.outputs[0].label, "[" + sound.properties.field + "]");
        const values = sound.properties_info.find(p => p.name === "field").values;
        assert(values.includes("ENTITY_PLAYER_LEVELUP"));
        for (const name of values) {
            const field = classStore.getField("org.bukkit.Sound", name);
            assert(field.isStatic && !field.isDeprecated);
        }
        sound.setProperty("field", "ENTITY_PLAYER_LEVELUP");
        assert.strictEqual(sound.outputs[0].label, "[ENTITY_PLAYER_LEVELUP]");
        const valued = H.add(graph, "io.papermc.paper.datacomponent.DataComponentTypes#static:io.papermc.paper.datacomponent.DataComponentType.Valued");
        const nonValued = H.add(graph, "io.papermc.paper.datacomponent.DataComponentTypes#static:io.papermc.paper.datacomponent.DataComponentType.NonValued");
        assert.strictEqual(valued.title, "DataComponentTypes: Valued");
        assert.strictEqual(nonValued.title, "DataComponentTypes: NonValued");
        assert.notStrictEqual(valued.outputs[0].type, nonValued.outputs[0].type);
        assert.strictEqual(Object.keys(H.LiteGraph().registered_node_types).some(type => type.startsWith("org.bukkit.Material#static:")), false);
    });
    it("keeps constant selections and Note text and size when saving and loading", async function () {
        const graph = await H.setup();
        const constant = H.add(graph, "org.bukkit.persistence.PersistentDataType#static:org.bukkit.persistence.PersistentDataType", {field: "STRING"});
        const note = H.add(graph, "annotations/Note", {text: "First line\nSecond line"});
        assert.strictEqual((note.widgets || []).length, 0);
        assert.deepStrictEqual(Array.from(note.computeSize()), [240, 120]);
        note.size = [400, 200];
        graph.configure(graph.serialize());
        const restored = graph.getNodeById(constant.id);
        const restoredNote = graph.getNodeById(note.id);
        assert.strictEqual(restored.properties.field, "STRING");
        assert.strictEqual(restored.outputs[0].label, "[STRING]");
        assert.strictEqual(restoredNote.properties.text, "First line\nSecond line");
        assert.deepStrictEqual(Array.from(restoredNote.size), [400, 200]);
        assert.strictEqual(restoredNote.resizable, true);
        assert.strictEqual((restoredNote.inputs || []).length, 0);
        assert.strictEqual((restoredNote.outputs || []).length, 0);
        assert.strictEqual((restoredNote.widgets || []).length, 0);
        assert.deepStrictEqual(Array.from(restoredNote.computeSize()), [140, 60]);
    });
    it("wraps Note text and preserves explicit line breaks", async function () {
        const graph = await H.setup();
        const note = H.add(graph, "annotations/Note", {text: "one two three\nfour\n\nfive"});
        note.size = [70, 160];
        const lines = [];
        const context = {save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, measureText: text => ({width: text.length * 8}), fillText: (text, x, y) => lines.push([text, x, y])};
        note.onDrawBackground(context);
        assert.deepStrictEqual(lines.map(line => line[0]), ["one", "two", "three", "four", "", "five"]);
        assert.deepStrictEqual(lines.map(line => line[2]), [20, 38, 56, 74, 92, 110]);
        note.flags.collapsed = true;
        note.onDrawBackground(context);
        assert.strictEqual(lines.length, 6);
    });
    it("offers cancellation only for cancellable events, including inherited interfaces", async function () {
        const graph = await H.setup();
        const cancel = H.add(graph, "events/CancelEvent");
        const cancellableClasses = new Set(classStore.getAllImplementingAndExtendingClasses("org.bukkit.event.Cancellable"));
        let inherited = 0;
        for (const clazz of Object.values(classStore.classStore).filter(clazz => clazz.isEvent)) {
            const event = H.add(graph, clazz.qualifiedName);
            assert.strictEqual(event.properties.priority, "NORMAL");
            assert.deepStrictEqual(event.properties_info.find(p => p.name === "priority").values, ["LOWEST", "LOW", "NORMAL", "HIGH", "HIGHEST", "MONITOR"]);
            if (cancellableClasses.has(clazz.qualifiedName)) {
                assert.strictEqual(event.properties.ignoreCancelled, false);
                H.link(event, "THIS", cancel, "event");
                if (!clazz.interfaces.includes("org.bukkit.event.Cancellable")) inherited++;
            } else {
                assert.strictEqual(event.properties.ignoreCancelled, undefined);
                assert.strictEqual(event.connect(H.outIdx(event, "THIS"), cancel, H.inIdx(cancel, "event")), null);
            }
        }
        assert(inherited > 0);
        assert.strictEqual(H.LiteGraph().isValidConnection("@EXEC", "org.bukkit.event.Cancellable"), false);
    });
    it("omits default or missing event options from annotations", async function () {
        const graph = await H.setup();
        const event = H.add(graph, "org.bukkit.event.block.BlockBreakEvent");
        for (const [priority, ignoreCancelled, annotation] of [
            [undefined, undefined, ""], ["NORMAL", false, ""],
            ["LOWEST", false, "(priority = org.bukkit.event.EventPriority.LOWEST)"],
            ["NORMAL", true, "(ignoreCancelled = true)"],
            ["MONITOR", true, "(priority = org.bukkit.event.EventPriority.MONITOR, ignoreCancelled = true)"]
        ]) {
            event.properties = {};
            if (priority !== undefined) event.properties.priority = priority;
            if (ignoreCancelled !== undefined) event.properties.ignoreCancelled = ignoreCancelled;
            const code = await H.gen(graph);
            assert(code.includes("@org.bukkit.event.EventHandler" + annotation + "\n"));
        }
    });
    it("continues execution when clearing cancellation or leaving the event input unconnected", async function () {
        const graph = await H.setup();
        cases["cancel-event"](graph);
        const cancel = graph._nodes.find(node => node.type === "events/CancelEvent");
        assert.strictEqual(cancel.properties.cancel, true);
        cancel.setProperty("cancel", false);
        const code = await H.gen(graph);
        assert(code.includes(".setCancelled(false);\nnode_4_exec();"));
        cancel.disconnectInput(H.inIdx(cancel, "event"));
        const unconnected = await H.gen(graph);
        assert(!unconnected.includes(".setCancelled("));
        assert(unconnected.includes("private void node_3_exec()"));
    });
});
