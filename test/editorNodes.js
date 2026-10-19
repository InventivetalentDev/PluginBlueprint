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
