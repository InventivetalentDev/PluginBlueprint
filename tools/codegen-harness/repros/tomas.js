// Read-only probe: builds small graphs with the app's own node + code generators
// (plain Node, no Electron) and compiles the output with javac against the
// Paper classpath from PB_JAVAC_ARGS. Writes into ../out/tomas.
const path = require("path");
const fs = require("fs");
const {execFileSync} = require("child_process");
const REPO = path.resolve(__dirname, "../../..");
// PB_JAVAC_ARGS: path to a compiled project's lib/javac.args (it holds the Paper classpath).
const GEN = path.join(__dirname, "..", "out", "tomas");

const realLog = console.log;
console.log = () => {};
console.warn = () => {};
console.debug = () => {};

const LG = require(REPO + "/assets/lib/litegraph/litegraph"); const {LiteGraph, LGraph} = LG; Object.assign(global, LG);
const NodeGenerator = require(REPO + "/js/nodeGenerator");
const CodeGenerator = require(REPO + "/js/codeGenerator");

// classpath from the evidence project's javac argfile
const argLines = fs.readFileSync(process.env.PB_JAVAC_ARGS, "utf8").split("\n");
const cp = JSON.parse(argLines[argLines.indexOf('"-cp"') + 1]);

function out(node, name) {
    let i = node.findOutputSlot(name);
    if (i === -1 && node.optional_outputs) {
        const e = node.optional_outputs.find(o => o[0] === name);
        if (!e) throw new Error("no output " + name + " on " + node.type);
        node.addOutput(e[0], e[1], e[2]);
        i = node.findOutputSlot(name);
    }
    if (i === -1) throw new Error("no output " + name + " on " + node.type);
    return i;
}
function inp(node, name) {
    const i = node.findInputSlot(name);
    if (i === -1) throw new Error("no input " + name + " on " + node.type + " have " + node.inputs.map(x => x.name));
    return i;
}
function link(graph, a, aOut, b, bIn) {
    const l = a.connect(out(a, aOut), b, inp(b, bIn));
    if (!l) throw new Error("connect refused: " + a.type + "." + aOut + " -> " + b.type + "." + bIn);
    return l;
}
function add(graph, type, props) {
    const n = LiteGraph.createNode(type);
    if (!n) throw new Error("no node type " + type);
    graph.add(n);
    if (props) for (const k in props) { n.properties[k] = props[k]; if (n.onPropertyChanged) n.onPropertyChanged(k, props[k]); }
    return n;
}

async function run(name, build) {
    const graph = new LGraph(); global.graph = graph;
    let note = "";
    try { note = build(graph) || ""; } catch (e) { realLog("### " + name + ": BUILD FAILED: " + e.message); return; }
    const code = await CodeGenerator.generateClassCode(graph, {package: "t", debug: false});
    const dir = path.join(GEN, name);
    fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(path.join(dir, "src", "t"), {recursive: true});
    fs.mkdirSync(path.join(dir, "classes"), {recursive: true});
    const src = path.join(dir, "src", "t", "GeneratedPlugin.java");
    fs.writeFileSync(src, code);
    let result;
    try {
        execFileSync("javac", ["-encoding", "UTF-8", "--release", "25", "-nowarn", "-cp", cp, "-d", path.join(dir, "classes"), src], {stdio: "pipe"});
        result = "COMPILES";
    } catch (e) {
        result = "JAVAC ERROR:\n" + String(e.stderr).split("\n").filter(l => /error:|^\s+\S/.test(l)).slice(0, 8).join("\n");
    }
    realLog("### " + name + (note ? " (" + note + ")" : "") + "\n" + result);
    const interesting = code.split("\n").filter(l => /node_\d+_output|return|onTabComplete|private V|private E|private T /.test(l) && !/^\/\*/.test(l)).slice(0, 14);
    realLog("  relevant generated lines:\n    " + interesting.join("\n    "));
}

(async () => {
    await NodeGenerator.init();

    // 1. Variables: Set then Get
    await run("variables-set-get", g => {
        const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
        const en = add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
        link(g, plugin, "onEnable()", en, "REF");
        const num = add(g, "constants/NumberConstant", {type: "int", number: 5});
        const set = add(g, "variables/Set", {name: "joinCount", type: "int"});
        link(g, en, "EXEC", set, "EXEC");
        num.connect(0, set, 1);
        const get = add(g, "variables/Get", {name: "joinCount", type: "int"});
        const log = add(g, "native/ConsoleLog");
        // Set has no EXEC output, so start the log from onEnable too
        link(g, en, "EXEC", log, "EXEC");
        get.connect(0, log, 1);
    });

    // 2. Two Set nodes for the same variable
    await run("variables-two-sets", g => {
        const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
        const en = add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
        link(g, plugin, "onEnable()", en, "REF");
        for (const v of [1, 2]) {
            const num = add(g, "constants/NumberConstant", {type: "int", number: v});
            const set = add(g, "variables/Set", {name: "joinCount", type: "int"});
            link(g, en, "EXEC", set, "EXEC");
            num.connect(0, set, 1);
        }
    });

    // 3. HashMap#get return value (generic V)
    await run("hashmap-get-return", g => {
        const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
        const en = add(g, "org.bukkit.plugin.java.JavaPlugin{onEnable()}");
        link(g, plugin, "onEnable()", en, "REF");
        const ctor = add(g, "java.util.HashMap#HashMap()");
        link(g, en, "EXEC", ctor, "EXEC");
        const map = add(g, "java.util.HashMap");
        link(g, ctor, "EXEC", map, "EXEC");
        link(g, ctor, "THIS", map, "REF");
        const get = add(g, "java.util.HashMap#get(java.lang.Object)");
        link(g, map, "get(Object)", get, "REF");
        link(g, map, "EXEC", get, "EXEC");
        const key = add(g, "constants/StringConstant", {string: "x"});
        key.connect(0, get, inp(get, "key"));
        const log = add(g, "native/ConsoleLog");
        link(g, get, "EXEC", log, "EXEC");
        get.connect(out(get, "RETURN"), log, 1);
        // can a UUID output reach put(K,V)'s key input?
        const put = add(g, "java.util.HashMap#put(K, V)");
        return "put(K,V) key input type = " + put.inputs[inp(put, "key")].type +
            "; UUID->K valid: " + LiteGraph.isValidConnection("java.util.UUID", put.inputs[inp(put, "key")].type);
    });

    // 4. onTabComplete wired to send a message
    await run("ontabcomplete", g => {
        const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
        const tab = add(g, "org.bukkit.plugin.java.JavaPlugin{onTabComplete(org.bukkit.command.CommandSender, org.bukkit.command.Command, java.lang.String, java.lang.String[])}");
        link(g, plugin, "onTabComplete(CommandSender, Command, String, String[])", tab, "REF");
        const cs = add(g, "org.bukkit.command.CommandSender");
        link(g, tab, "EXEC", cs, "EXEC");
        link(g, tab, "sender", cs, "REF");
        const m = add(g, "org.bukkit.command.CommandSender#sendRichMessage(java.lang.String)");
        link(g, cs, "sendRichMessage(String)", m, "REF");
        link(g, cs, "EXEC", m, "EXEC");
        add(g, "constants/StringConstant", {string: "tab!"}).connect(0, m, inp(m, "message"));
    });

    // 5. onCommand with RETURN = false (to show usage)
    await run("oncommand-return-false", g => {
        const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
        const cmd = add(g, "org.bukkit.plugin.java.JavaPlugin{onCommand(org.bukkit.command.CommandSender, org.bukkit.command.Command, java.lang.String, java.lang.String[])}");
        link(g, plugin, "onCommand(CommandSender, Command, String, String[])", cmd, "REF");
        add(g, "constants/BooleanConstant", {value: false}).connect(0, cmd, inp(cmd, "RETURN"));
    });

    // 6. args[0] -> Bukkit.getPlayer(String), without and with Cast
    for (const withCast of [false, true]) {
        await run("args-getplayer" + (withCast ? "-cast" : ""), g => {
            const plugin = add(g, "org.bukkit.plugin.java.JavaPlugin");
            const cmd = add(g, "org.bukkit.plugin.java.JavaPlugin{onCommand(org.bukkit.command.CommandSender, org.bukkit.command.Command, java.lang.String, java.lang.String[])}");
            link(g, plugin, "onCommand(CommandSender, Command, String, String[])", cmd, "REF");
            const gi = add(g, "arrays/GetIndex");
            link(g, cmd, "EXEC", gi, "EXEC");
            link(g, cmd, "args", gi, "Array");
            add(g, "constants/NumberConstant", {type: "int", number: 0}).connect(0, gi, inp(gi, "index"));
            let src = gi, srcSlot = "Value", last = gi;
            if (withCast) {
                const c = add(g, "native/Cast", {castTo: "java.lang.String"});
                link(g, gi, "EXEC", c, "EXEC");
                gi.connect(out(gi, "Value"), c, 1);
                src = c; srcSlot = 1; last = c;
            }
            const bk = add(g, "org.bukkit.Bukkit");
            const gp = add(g, "org.bukkit.Bukkit#getPlayer(java.lang.String)");
            link(g, bk, "getPlayer(String)", gp, "REF");
            link(g, last, "EXEC", gp, "EXEC");
            const ok = src.connect(typeof srcSlot === "number" ? srcSlot : out(src, srcSlot), gp, inp(gp, "name"));
            if (!ok) throw new Error("connect refused into getPlayer(name)");
        });
    }
})().catch(e => { realLog("FATAL", e.stack); process.exit(1); });
