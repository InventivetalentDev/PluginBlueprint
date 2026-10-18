const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {spawnSync} = require("child_process");
const H = require("./support/harness");
const ClassDataStore = require("../out/lib/classDataStore");
const {getClasspath} = require("../out/lib/paper");
const classStore = new ClassDataStore();
const snapshotDir = path.join(__dirname, "snapshots/codegen");
const cases = {};

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

describe("Codegen", function () {
    this.timeout(30000);
    before(async function () {
        await H.setup();
        await classStore.init();
    });
    for (const [name, build] of Object.entries(cases)) {
        it(name + " matches its snapshot", async function () {
            const graph = await H.setup();
            build(graph);
            const code = (await H.gen(graph, true)).replace(/\r\n/g, "\n");
            if (name === "note-ignored") assert.strictEqual(code, fs.readFileSync(path.join(snapshotDir, "join-message.java"), "utf8"));
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
