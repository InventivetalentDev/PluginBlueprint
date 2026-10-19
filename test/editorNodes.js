const assert = require("assert");
const H = require("./support/harness");

describe("MakeArray editor connections", function () {
    let graph;
    beforeEach(async function () {
        this.timeout(30000);
        graph = await H.setup();
    });

    it("takes its element type from the first ItemStack connection", function () {
        const item = H.add(graph, "org.bukkit.inventory.ItemStack");
        const array = H.add(graph, "arrays/MakeArray");
        H.link(item, "THIS", array, "Element");
        assert.equal(array.properties.type, "org.bukkit.inventory.ItemStack");
        assert.equal(array.inputs[1].type, "org.bukkit.inventory.ItemStack");
        assert.equal(array.outputs[1].type, "org.bukkit.inventory.ItemStack[]");
    });

    it("keeps a saved type when configuring linked nodes", async function () {
        const item = H.add(graph, "org.bukkit.inventory.ItemStack");
        const array = H.add(graph, "arrays/MakeArray");
        H.link(item, "THIS", array, "Element");
        array.setProperty("type", "java.lang.String");
        const saved = graph.serialize();
        const restored = await H.setup();
        restored.configure(saved);
        const loaded = restored.getNodeById(array.id);
        assert.equal(loaded.properties.type, "java.lang.String");
        assert.equal(loaded.inputs[1].type, "java.lang.String");
        assert.equal(loaded.outputs[1].type, "java.lang.String[]");
    });

    it("ignores EXEC links, invalid Java types and missing link data", function () {
        const array = H.add(graph, "arrays/MakeArray");
        const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
        H.link(event, "EXEC", array, "EXEC");
        array.onConnectionsChange(LiteGraph.INPUT, 1, true, null);
        assert.equal(array.properties.type, "java.lang.Object");
        const origin = H.add(graph, "constants/NumberConstant");
        origin.outputs[0].type = "Player#getName()";
        array.onConnectionsChange(LiteGraph.INPUT, 1, true, {origin_id: origin.id, origin_slot: 0});
        assert.equal(array.properties.type, "java.lang.Object");
    });

    it("preserves an explicit type and output link colours", function () {
        const number = H.add(graph, "constants/NumberConstant");
        const array = H.add(graph, "arrays/MakeArray", {type: "int"});
        H.link(number, 0, array, "Element");
        assert.equal(array.properties.type, "int");
        const target = H.add(graph, "arrays/SetIndex");
        const link = H.link(array, "EXEC", target, "EXEC");
        assert.equal(link.color, LGraphCanvas.link_type_colors["@EXEC"]);
    });
});

describe("Java code node slots", function () {
    const PLAYER = "org.bukkit.entity.Player";
    let graph;
    beforeEach(async function () {
        this.timeout(30000);
        graph = await H.setup();
    });
    const out = (node, name) => node.outputs.findIndex(slot => slot.name === name);
    const inp = (node, name) => node.inputs.findIndex(slot => slot.name === name);

    it("adds a typed input when an output is dropped on the node body", function () {
        const player = H.add(graph, PLAYER);
        const code = H.add(graph, "code/JavaCode");
        assert.ok(player.connectByType(out(player, "THIS"), code, PLAYER));
        assert.deepEqual(code.properties.codeInputs, [{name: "player", type: PLAYER}]);
        assert.equal(code.inputs[1].type, PLAYER);
        assert.equal(graph.links[code.inputs[1].link].origin_id, player.id);
    });

    it("records a dropped link and its new input as one change", function () {
        const player = H.add(graph, PLAYER);
        const code = H.add(graph, "code/JavaCode");
        const changes = [];
        graph.onAfterChange = graph.onConnectionChange = () => changes.push(code.inputs.length + (code.inputs[1]?.link != null ? " linked" : ""));
        player.connectByType(out(player, "THIS"), code, PLAYER);
        assert.ok(changes.length > 0);
        assert.ok(changes.every(change => change === "2 linked"), changes.join(", "));
    });

    it("reuses a free input of the same type and numbers new names", function () {
        const player = H.add(graph, PLAYER);
        const code = H.add(graph, "code/JavaCode");
        code.addCodeSlot(true, "target", PLAYER);
        player.connectByType(out(player, "THIS"), code, PLAYER);
        assert.deepEqual(code.properties.codeInputs.map(slot => slot.name), ["target"]);
        assert.ok(code.inputs[1].link != null);
        player.connectByType(out(player, "THIS"), code, PLAYER);
        player.connectByType(out(player, "THIS"), code, PLAYER);
        assert.deepEqual(code.properties.codeInputs.map(slot => slot.name), ["target", "player", "player2"]);
    });

    it("names slots after the method and leaves EXEC links alone", function () {
        const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
        const getName = H.add(graph, "org.bukkit.command.CommandSender#getName()");
        const code = H.add(graph, "code/JavaCode");
        getName.connectByType(out(getName, "RETURN"), code, "java.lang.String");
        event.connectByType(out(event, "EXEC"), code, "@EXEC");
        assert.deepEqual(code.properties.codeInputs, [{name: "name", type: "java.lang.String"}]);
        assert.equal(graph.links[code.inputs[0].link].origin_id, event.id);
    });

    it("derives names from slot names and types", function () {
        const code = H.add(graph, "code/JavaCode");
        for (const [name, type] of [["getUniqueId", "java.util.UUID"], ["THIS", "java.net.URI"], ["", "int"], ["class", "java.lang.Class"], ["Formatted", "java.lang.String"]]) {
            code.addSlotForLink(true, {name, type}, code);
        }
        assert.deepEqual(code.properties.codeInputs.map(slot => slot.name), ["uniqueId", "uri", "value", "value2", "formatted"]);
    });

    it("adds an output when an input is dropped on the node body", function () {
        const send = H.add(graph, "org.bukkit.command.CommandSender#sendRichMessage(java.lang.String)");
        const code = H.add(graph, "code/JavaCode");
        assert.ok(send.connectByTypeOutput(inp(send, "message"), code, send.inputs[inp(send, "message")].type));
        assert.deepEqual(code.properties.codeOutputs, [{name: "message", type: "java.lang.String"}]);
        assert.equal(graph.links[send.inputs[inp(send, "message")].link].origin_id, code.id);
        send.connectByTypeOutput(inp(send, "REF"), code, send.inputs[inp(send, "REF")].type);
        assert.equal(code.properties.codeOutputs.length, 1);
    });

    it("renames a slot and the variable in the code", function () {
        const code = H.add(graph, "code/JavaCode", {code: "player.sendMessage(\"hi\");\nother.player = 1;\nint players = 0;"});
        code.addCodeSlot(true, "player", PLAYER);
        code.addCodeSlot(false, "count", "int");
        assert.equal(code.renameCodeSlot(true, 1, "count"), false);
        assert.equal(code.renameCodeSlot(true, 1, "int"), false);
        assert.equal(code.renameCodeSlot(true, 1, "target"), true);
        assert.deepEqual(code.properties.codeInputs, [{name: "target", type: PLAYER}]);
        assert.equal(code.inputs[1].name, "target");
        assert.equal(code.properties.code, "target.sendMessage(\"hi\");\nother.player = 1;\nint players = 0;");
    });

    it("keeps added slots and links after saving and loading", async function () {
        const player = H.add(graph, PLAYER);
        const code = H.add(graph, "code/JavaCode");
        player.connectByType(out(player, "THIS"), code, PLAYER);
        code.renameCodeSlot(true, 1, "target");
        const restored = await H.setup();
        restored.configure(graph.serialize());
        const loaded = restored.getNodeById(code.id);
        assert.deepEqual(loaded.inputs.map(slot => slot.name), ["EXEC", "target"]);
        assert.equal(restored.links[loaded.inputs[1].link].origin_id, player.id);
    });
});
