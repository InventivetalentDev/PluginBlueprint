const assert = require("assert");
const fs = require("fs");
const path = require("path");
const H = require("./support/harness");
const ClassDataStore = require("../out/lib/classDataStore");
const {validateGraph, classStore} = require("../out/lib/graphValidator");

const nativeTypes = [
    "arithmetic/Add", "arithmetic/Subtract", "arithmetic/Multiply", "arithmetic/Divide", "arithmetic/Modulus",
    "relational/Equal", "relational/NotEqual", "relational/GreaterThan", "relational/GreaterEqualTo", "relational/LessThan", "relational/LessEqualTo",
    "logic/NotGate", "logic/AndGate", "logic/OrGate", "native/ConsoleLog", "native/StringFormat", "flow/ForLoop",
    "arrays/SetIndex", "arrays/GetIndex", "arrays/Length"
];
function plug(graph, node, index, type) {
    const value = H.add(graph, "constants/NumberConstant");
    value.outputs[0].type = type || node.inputs[index].type || "int";
    return H.link(value, 0, node, index);
}
function execute(graph, node) {
    const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
    H.link(event, "EXEC", node, "EXEC");
}
function stub(type, property) {
    if (H.LiteGraph().registered_node_types[type]) return;
    function Node() { this.addProperty(property, ""); }
    H.LiteGraph().registerNodeType(type, Node);
}

describe("GraphValidator", function () {
    this.timeout(30000);
    let graph;
    before(async function () { await H.setup(); await classStore.init(); stub("commands/Command", "name"); stub("config/ConfigValue", "key"); });
    beforeEach(async function () { graph = await H.setup(); });

    it("shares loaded class data and metadata between instances", async function () {
        const first = new ClassDataStore();
        const second = new ClassDataStore();
        await Promise.all([first.init(), second.init()]);
        const clazz = first.getClass("org.bukkit.event.player.PlayerJoinEvent");
        assert(clazz);
        assert.strictEqual(second.getClass("org.bukkit.event.player.PlayerJoinEvent"), clazz);
        assert.strictEqual(first.classStore, second.classStore);
        assert.strictEqual(first.meta, second.meta);
    });
    it("rejects stale connection ids on native EXEC outputs", function () {
        const node = H.add(graph, "flow/Switch");
        execute(graph, node);
        node.outputs[0].links = [99999];
        const problems = validateGraph(graph, {});
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].severity, "error");
        assert.strictEqual(problems[0].nodeId, node.id);
        assert.match(problems[0].message, /output.*connection that no longer exists/);
    });
    it("accepts native EXEC outputs with valid connections", function () {
        const first = H.add(graph, "flow/Switch");
        const second = H.add(graph, "flow/Switch");
        execute(graph, first);
        H.link(first, 0, second, "EXEC");
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("reports a crafted link field as a damaged connection on its target node", function () {
        const value = H.add(graph, "constants/StringConstant");
        const log = H.add(graph, "native/ConsoleLog");
        execute(graph, log);
        const link = H.link(value, 0, log, 1);
        link.origin_slot = "0; injected()";
        const problems = validateGraph(graph, {}).filter(problem => /file is damaged/.test(problem.message));
        assert.strictEqual(problems.length, 1);
        assert.strictEqual(problems[0].severity, "error");
        assert.strictEqual(problems[0].nodeId, log.id);
    });
    for (const defect of ["origin", "target", "origin slot", "target slot", "output backlink", "input backlink"]) {
        it("rejects a dangling connection: " + defect, function () {
            const value = H.add(graph, "constants/StringConstant");
            const log = H.add(graph, "native/ConsoleLog");
            execute(graph, log);
            const link = H.link(value, 0, log, 1);
            assert.deepStrictEqual(validateGraph(graph, {}), []);
            if (defect === "origin") link.origin_id = 99999;
            if (defect === "target") link.target_id = 99999;
            if (defect === "origin slot") link.origin_slot = 99;
            if (defect === "target slot") link.target_slot = -1;
            if (defect === "output backlink") value.outputs[0].links = [];
            if (defect === "input backlink") log.inputs[1].link = null;
            assert(validateGraph(graph, {}).some(p => p.severity === "error" && /connection/.test(p.message)));
        });
    }
    it("rejects an input pointing to a missing connection", function () {
        const node = H.add(graph, "flow/Switch");
        execute(graph, node);
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        delete graph.links[node.inputs[0].link];
        assert.match(validateGraph(graph, {})[0].message, /connection that no longer exists/);
    });
    it("rejects unknown placeholders and accepts registered nodes", function () {
        const node = H.add(graph, "constants/StringConstant");
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        node.type = "future/Unknown";
        assert.match(validateGraph(graph, {})[0].message, /future\/Unknown/);
    });
    it("requires a non-static method's REF and accepts a connected REF", function () {
        const send = H.add(graph, "org.bukkit.command.CommandSender#sendMessage(java.lang.String)");
        execute(graph, send);
        plug(graph, send, H.inIdx(send, "message"));
        assert(validateGraph(graph, {}).some(p => /Connect the REF/.test(p.message)));
        const player = H.add(graph, "org.bukkit.entity.Player");
        execute(graph, player);
        H.link(player, H.addOptOut(player, "sendMessage(String)"), send, "REF");
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("accepts a static method without REF", function () {
        const method = H.add(graph, "java.lang.String#valueOf(int)");
        execute(graph, method);
        plug(graph, method, H.inIdx(method, "i"));
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    for (const type of nativeTypes) {
        it("requires unsafe data inputs on " + type, function () {
            const node = H.add(graph, type);
            execute(graph, node);
            const inputs = node.inputs.map((input, index) => input.type !== "@EXEC" ? index : -1).filter(index => index >= 0);
            const required = type === "native/StringFormat" ? [1] : type === "arrays/SetIndex" ? [1, 2] : inputs;
            for (const index of required) assert(validateGraph(graph, {}).some(p => p.severity === "error" && p.nodeId === node.id && p.message.includes('"' + (node.inputs[index].name || "value") + '"')));
            for (const index of inputs) plug(graph, node, index);
            assert.deepStrictEqual(validateGraph(graph, {}), []);
        });
    }
    for (const [type, property] of [["native/Cast", "castTo"], ["variables/Set", "type"]]) {
        it("requires a primitive input but allows null for an object on " + type, function () {
            const node = H.add(graph, type, {[property]: "int"});
            execute(graph, node);
            assert.strictEqual(validateGraph(graph, {})[0].severity, "error");
            node.properties[property] = "java.lang.Object";
            assert.deepStrictEqual(validateGraph(graph, {}), []);
            node.properties[property] = "int";
            plug(graph, node, 1);
            assert.deepStrictEqual(validateGraph(graph, {}), []);
        });
    }
    it("requires SetIndex's value only for a primitive array", function () {
        const node = H.add(graph, "arrays/SetIndex");
        execute(graph, node);
        const array = plug(graph, node, 1, "int[]");
        plug(graph, node, 2);
        assert(validateGraph(graph, {}).some(p => /"Value"/.test(p.message)));
        graph.getNodeById(array.origin_id).outputs[0].type = "java.lang.Object[]";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("allows empty MakeArray and trailing commas but rejects empty middle elements", function () {
        const node = H.add(graph, "arrays/MakeArray");
        execute(graph, node);
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        H.addOptIn(node, "Element");
        assert(validateGraph(graph, {}).some(p => /Connect the "Element"/.test(p.message)));
        plug(graph, node, 1);
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    for (const type of ["flow/Switch", "events/CancelEvent", "native/InstanceOf"]) {
        it("accepts guarded or safe missing inputs on " + type, function () {
            const node = H.add(graph, type);
            execute(graph, node);
            assert.deepStrictEqual(validateGraph(graph, {}), []);
        });
    }
    for (const [type, parameter, fallback] of [["java.lang.String#valueOf(int)", "i", "0"], ["java.lang.String#valueOf(boolean)", "b", "false"], ["java.lang.String#valueOf(java.lang.Object)", "obj", "null"], ["java.lang.String#String(java.lang.String)", "original", "null"]]) {
        it("warns about an unconnected parameter: " + type, function () {
            const node = H.add(graph, type);
            execute(graph, node);
            const problems = validateGraph(graph, {});
            assert.strictEqual(problems.length, 1);
            assert.strictEqual(problems[0].severity, "warning");
            assert.match(problems[0].message, new RegExp("gets " + fallback));
            plug(graph, node, H.inIdx(node, parameter));
            assert.deepStrictEqual(validateGraph(graph, {}), []);
        });
    }
    it("warns about missing EXEC and clears the warning when connected", function () {
        const node = H.add(graph, "flow/Switch");
        assert.match(validateGraph(graph, {})[0].message, /never runs/);
        execute(graph, node);
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("rejects linked legacy generic slots, but accepts an unlinked slot or erased Object", function () {
        const value = H.add(graph, "constants/StringConstant");
        value.outputs[0].type = "T";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        const log = H.add(graph, "native/ConsoleLog");
        execute(graph, log);
        H.link(value, 0, log, 1);
        assert.match(validateGraph(graph, {})[0].message, /generic type \(T\)/);
        value.outputs[0].type = "java.lang.Object";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("rejects skipped method data outputs, but accepts method references", function () {
        const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
        const output = H.addOptOut(event, "getPlayer");
        const log = H.add(graph, "native/ConsoleLog");
        H.link(event, "EXEC", log, "EXEC");
        H.link(event, output, log, 1);
        event.outputs[output].linkType = "method";
        assert(validateGraph(graph, {}).some(p => /generator can't use/.test(p.message)));
        event.outputs[output].linkType = "object";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("rejects an abstract event listener and accepts an object reference", function () {
        const event = H.add(graph, "org.bukkit.event.player.PlayerEvent");
        execute(graph, event);
        assert(validateGraph(graph, {}).some(p => /can't be listened to/.test(p.message)));
        plug(graph, event, H.inIdx(event, "REF"));
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    it("requires matching variable types and valid Java names", function () {
        const first = H.add(graph, "variables/Get", {name: "count", type: "int"});
        const second = H.add(graph, "variables/Get", {name: "count", type: "string"});
        assert.strictEqual(validateGraph(graph, {}).length, 2);
        second.properties.type = "int";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        for (const name of ["two words", "class", "true", "_", "3count", ""]) {
            first.properties.name = name;
            assert(validateGraph(graph, {}).some(p => /Java identifier/.test(p.message)));
        }
        first.properties.name = "$café_2";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
    });
    for (const [type, property, value] of [
        ["native/Cast", "castTo", "java.lang.Object;"],
        ["constants/NumberConstant", "number", "0; static {}"],
        ["org.bukkit.Material", "en", "STONE;"]
    ]) {
        it("reports one property error on " + type, function () {
            const node = H.add(graph, type);
            if (node.inputs?.some(input => input.type === "@EXEC")) execute(graph, node);
            node.properties[property] = value;
            const problems = validateGraph(graph, {}).filter(problem => problem.severity === "error");
            assert.strictEqual(problems.length, 1);
            assert.strictEqual(problems[0].nodeId, node.id);
        });
    }
    it("rejects duplicate Command names and warns about the project command list", function () {
        const first = H.add(graph, "commands/Command", {name: "heal"});
        const second = H.add(graph, "commands/Command", {name: "heal"});
        assert(validateGraph(graph, {}).some(p => p.severity === "error" && /named \/heal/.test(p.message)));
        second.properties.name = "feed";
        assert.deepStrictEqual(validateGraph(graph, {}), []);
        const warnings = validateGraph(graph, {commands: [{name: first.properties.name}]});
        assert.strictEqual(warnings.length, 1);
        assert.strictEqual(warnings[0].severity, "warning");
    });
    it("requires ConfigValue to select a declared key", function () {
        const node = H.add(graph, "config/ConfigValue");
        assert.match(validateGraph(graph, {})[0].message, /Pick a key/);
        node.properties.key = "messages.welcome";
        assert.match(validateGraph(graph, {})[0].message, /messages.welcome/);
        assert.deepStrictEqual(validateGraph(graph, {config: [{key: "messages.welcome"}]}), []);
    });
    for (const keys of [["a..b"], ["a.b", "a.b"], ["a", "a.b"], ["a.b", "a"]]) {
        it("rejects an invalid config table: " + keys.join(", "), function () {
            assert(validateGraph(graph, {config: keys.map(key => ({key}))}).every(p => p.severity === "error"));
            assert(validateGraph(graph, {config: keys.map(key => ({key}))}).length > 0);
            assert.deepStrictEqual(validateGraph(graph, {config: [{key: "a.b"}, {key: "a.c-d_2"}]}), []);
        });
    }
    for (const file of ["assets/snippets/onEnableLog.pbs", ...fs.readdirSync(path.join(__dirname, "../docs/examples")).filter(file => file.endsWith(".pbs")).map(file => "docs/examples/" + file)]) {
        it("finds zero problems and leaves " + file + " unchanged", function () {
            H.loadSnippet(graph, JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8")));
            const before = JSON.stringify(graph.serialize());
            assert.deepStrictEqual(validateGraph(graph, {}), []);
            assert.strictEqual(JSON.stringify(graph.serialize()), before);
        });
    }
});
