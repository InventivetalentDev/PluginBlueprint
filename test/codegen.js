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
});
