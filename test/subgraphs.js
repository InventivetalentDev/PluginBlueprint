const assert = require("assert");
const H = require("./support/harness");
const {SUBGRAPH, SUBGRAPH_INPUT, SUBGRAPH_OUTPUT, flattenGraph, convertToSubgraph, pathOf, eachGraph, resolvePath, canvasPath, subgraphProblems} = require("../out/lib/subgraphs");
const {pickNodeKeys, SourceError} = require("../out/lib/sourceChecks");
const {nodeForLine} = require("../out/lib/javacErrors");
const History = require("../out/lib/history");

function pin(sub, input, type = "@EXEC", name = input ? "input" : "output") {
    return H.add(sub.subgraph, input ? SUBGRAPH_INPUT : SUBGRAPH_OUTPUT, {name, type});
}
function flatNode(flat, path) {
    const id = [...flat.paths].find(([, value]) => JSON.stringify(value) === JSON.stringify(path))?.[0];
    assert.notStrictEqual(id, undefined);
    return flat.graph.getNodeById(id);
}
function targets(graph, node, slot = 0) {
    return (node.outputs[slot].links || []).map(id => graph.links[id].target_id);
}

describe("Subgraphs", function () {
    this.timeout(30000);
    let graph;
    beforeEach(async function () { graph = await H.setup(); });

    it("returns the original graph without subgraphs", function () {
        H.add(graph, "constants/StringConstant");
        const flat = flattenGraph(graph);
        assert.strictEqual(flat.graph, graph);
        assert.strictEqual(flat.paths.size, 0);
        assert.deepStrictEqual(pathOf(flat.paths, 4), [4]);
    });
    it("allocates inner ids above last_node_id and maps only scratch nodes", function () {
        const sub = H.add(graph, SUBGRAPH);
        const text = H.add(sub.subgraph, "constants/StringConstant");
        graph.last_node_id = 100;
        graph.last_link_id = 200;
        const saved = JSON.stringify(graph.serialize());
        const flat = flattenGraph(graph);
        const node = flatNode(flat, [sub.id, text.id]);
        assert(node.id > 100);
        for (const id of flat.paths.keys()) assert(flat.graph.getNodeById(id));
        assert.strictEqual(JSON.stringify(graph.serialize()), saved);
        assert.notStrictEqual(flat.graph, graph);
    });
    it("fans an EXEC pin out in place without changing target order", function () {
        const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
        const before = H.add(graph, "native/ConsoleLog");
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true);
        const first = H.add(sub.subgraph, "native/ConsoleLog");
        const second = H.add(sub.subgraph, "native/ConsoleLog");
        const after = H.add(graph, "native/ConsoleLog");
        H.link(event, "EXEC", before, "EXEC");
        H.link(event, "EXEC", sub, 0);
        H.link(event, "EXEC", after, "EXEC");
        H.link(input, 0, first, "EXEC");
        H.link(input, 0, second, "EXEC");
        const flat = flattenGraph(graph);
        assert.deepStrictEqual(targets(flat.graph, flat.graph.getNodeById(event.id), H.outIdx(event, "EXEC")), [before.id, flatNode(flat, [sub.id, first.id]).id, flatNode(flat, [sub.id, second.id]).id, after.id]);
        assert(Object.keys(flat.graph.links).map(Number).some(id => id > graph.last_link_id));
    });
    it("fans data out and preserves outer output link order", function () {
        const text = H.add(graph, "constants/StringConstant");
        const before = H.add(graph, "native/ConsoleLog");
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true, "java.lang.String");
        const first = H.add(sub.subgraph, "native/ConsoleLog");
        const second = H.add(sub.subgraph, "native/ConsoleLog");
        const after = H.add(graph, "native/ConsoleLog");
        H.link(text, 0, before, 1);
        H.link(text, 0, sub, 0);
        H.link(text, 0, after, 1);
        H.link(input, 0, first, 1);
        H.link(input, 0, second, 1);
        const flat = flattenGraph(graph);
        assert.deepStrictEqual(targets(flat.graph, flat.graph.getNodeById(text.id)), [before.id, flatNode(flat, [sub.id, first.id]).id, flatNode(flat, [sub.id, second.id]).id, after.id]);
    });
    it("connects pass-through input directly to all output targets", function () {
        const text = H.add(graph, "constants/StringConstant");
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true, "java.lang.String");
        const output = pin(sub, false, "java.lang.String");
        H.link(input, 0, output, 0);
        H.link(text, 0, sub, 0);
        const first = H.add(graph, "native/ConsoleLog");
        const second = H.add(graph, "native/ConsoleLog");
        H.link(sub, 0, first, 1);
        H.link(sub, 0, second, 1);
        const flat = flattenGraph(graph);
        assert.deepStrictEqual(targets(flat.graph, flat.graph.getNodeById(text.id)), [first.id, second.id]);
        assert.strictEqual(flat.graph.links[flat.graph.getNodeById(first.id).inputs[1].link].origin_id, text.id);
        sub.disconnectInput(0);
        const empty = flattenGraph(graph).graph;
        assert.strictEqual(empty.getNodeById(first.id).inputs[1].link, null);
        assert.strictEqual(empty.getNodeById(second.id).inputs[1].link, null);
    });
    it("unlinks inner targets of an empty input and outer targets of an empty output", function () {
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true);
        pin(sub, false);
        const inside = H.add(sub.subgraph, "native/ConsoleLog");
        const outside = H.add(graph, "native/ConsoleLog");
        H.link(input, 0, inside, 0);
        H.link(sub, 0, outside, 0);
        const flat = flattenGraph(graph);
        assert.strictEqual(flatNode(flat, [sub.id, inside.id]).inputs[0].link, null);
        assert.strictEqual(flat.graph.getNodeById(outside.id).inputs[0].link, null);
        assert.deepStrictEqual(Object.keys(flat.graph.links), []);
    });
    it("expands nested subgraphs and resolves their paths", function () {
        const event = H.add(graph, "org.bukkit.event.player.PlayerJoinEvent");
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true);
        const nested = H.add(sub.subgraph, SUBGRAPH);
        const nestedInput = pin(nested, true);
        const log = H.add(nested.subgraph, "native/ConsoleLog");
        H.link(event, "EXEC", sub, 0);
        H.link(input, 0, nested, 0);
        H.link(nestedInput, 0, log, 0);
        const flat = flattenGraph(graph);
        const path = [sub.id, nested.id, log.id];
        const node = flatNode(flat, path);
        assert.deepStrictEqual(targets(flat.graph, flat.graph.getNodeById(event.id), H.outIdx(event, "EXEC")), [node.id]);
        assert.strictEqual(resolvePath(graph, path), log);
        assert.strictEqual(resolvePath(graph, [sub.id, 999]), undefined);
        assert.deepStrictEqual(canvasPath({graph: nested.subgraph}), [sub.id, nested.id]);
        const paths = [];
        eachGraph(graph, (inner, path) => paths.push(path));
        assert.deepStrictEqual(paths, [[], [sub.id], [sub.id, nested.id]]);
    });
    it("unlinks root boundaries and orphaned inner boundaries", function () {
        const input = H.add(graph, SUBGRAPH_INPUT, {type: "@EXEC"});
        const log = H.add(graph, "native/ConsoleLog");
        H.link(input, 0, log, 0);
        const flat = flattenGraph(graph);
        assert.strictEqual(flat.graph.getNodeById(input.id), undefined);
        assert.strictEqual(flat.graph.getNodeById(log.id).inputs[0].link, null);
        assert.deepStrictEqual(Object.keys(flat.graph.links), []);
        const sub = H.add(graph, SUBGRAPH);
        const orphan = pin(sub, true);
        const inside = H.add(sub.subgraph, "native/ConsoleLog");
        H.link(orphan, 0, inside, 0);
        sub.inputs = [];
        const orphaned = flattenGraph(graph);
        assert.strictEqual(flatNode(orphaned, [sub.id, inside.id]).inputs[0].link, null);
    });
    it("throws a SourceError with a path for missing, wrong-kind and duplicate boundaryIds", function () {
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true);
        const output = pin(sub, false);
        for (const id of [undefined, 999, output.id]) {
            sub.inputs[0].boundaryId = id;
            assert.throws(() => flattenGraph(graph), error => error instanceof SourceError && error.path.join() === String(sub.id));
        }
        sub.inputs[0].boundaryId = input.id;
        sub.inputs.push({...sub.inputs[0]});
        assert.throws(() => flattenGraph(graph), SourceError);
    });
    it("checks nested ids and boundary types and warns about duplicate names", function () {
        const sub = H.add(graph, SUBGRAPH);
        pin(sub, true, "int", "value");
        const duplicate = pin(sub, true, "bad type", "value");
        assert(subgraphProblems(graph).some(problem => problem.severity === "warning" && problem.path[1] === duplicate.id));
        assert(subgraphProblems(graph).some(problem => problem.severity === "error" && /pin type/.test(problem.message)));
        duplicate.id = "bad";
        assert.throws(() => flattenGraph(graph), error => error instanceof SourceError && error.path[0] === sub.id);
    });
    it("converts with one boundary per crossing source and keeps types and internal ids", function () {
        const text = H.add(graph, "constants/StringConstant");
        const first = H.add(graph, "native/Cast");
        const second = H.add(graph, "native/Cast");
        const outside = H.add(graph, "native/ConsoleLog");
        first.pos = [200, 150];
        second.pos = [400, 250];
        H.link(text, 0, first, 1);
        H.link(text, 0, second, 1);
        H.link(first, 0, second, 0);
        H.link(second, 0, outside, 0);
        const id = convertToSubgraph(graph, [first.id, second.id]);
        const sub = graph.getNodeById(id);
        assert.deepStrictEqual(Array.from(sub.pos), [200, 150]);
        assert.strictEqual(sub.inputs.length, 1);
        assert.strictEqual(sub.inputs[0].type, "java.lang.String");
        assert.strictEqual(sub.outputs.length, 1);
        assert.strictEqual(sub.outputs[0].type, "@EXEC");
        assert(sub.subgraph.getNodeById(first.id));
        assert(sub.subgraph.getNodeById(second.id));
        assert.strictEqual(graph._nodes[1], sub);
        const flat = flattenGraph(graph);
        const a = flatNode(flat, [id, first.id]);
        const b = flatNode(flat, [id, second.id]);
        assert.deepStrictEqual(targets(flat.graph, flat.graph.getNodeById(text.id)), [a.id, b.id]);
        assert.deepStrictEqual(targets(flat.graph, a), [b.id]);
        assert.deepStrictEqual(targets(flat.graph, b), [outside.id]);
    });
    it("keeps outgoing fan-out in order after conversion", function () {
        const first = H.add(graph, "native/Cast");
        const note = H.add(graph, "annotations/Note");
        const a = H.add(graph, "native/ConsoleLog");
        const b = H.add(graph, "native/ConsoleLog");
        H.link(first, 0, a, 0);
        H.link(first, 0, b, 0);
        const id = convertToSubgraph(graph, [first.id, note.id]);
        const sub = graph.getNodeById(id);
        assert.strictEqual(sub.outputs.length, 1);
        const flat = flattenGraph(graph);
        assert.deepStrictEqual(targets(flat.graph, flatNode(flat, [id, first.id])), [a.id, b.id]);
    });
    it("synchronizes pins on add, rename, retype and remove", function () {
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true, "java.lang.String");
        const second = pin(sub, true, "int", "count");
        const text = H.add(graph, "constants/StringConstant");
        H.link(text, 0, sub, 0);
        input.setProperty("name", "message");
        assert.strictEqual(sub.inputs[0].name, "message");
        assert.strictEqual(sub.inputs[0].label, "message");
        assert.notStrictEqual(sub.inputs[0].link, null);
        input.setProperty("type", "int");
        assert.strictEqual(sub.inputs[0].type, "int");
        assert.strictEqual(sub.inputs[0].link, null);
        sub.subgraph.remove(input);
        assert.strictEqual(sub.inputs.length, 1);
        assert.strictEqual(sub.inputs[0].boundaryId, second.id);
        const output = pin(sub, false, "java.lang.String");
        const log = H.add(graph, "native/ConsoleLog");
        H.link(sub, 0, log, 1);
        output.setProperty("name", "result");
        assert.strictEqual(sub.outputs[0].label, "result");
        sub.subgraph.remove(output);
        assert.strictEqual(sub.outputs.length, 0);
        assert.strictEqual(log.inputs[1].link, null);
    });
    it("adopts connected slot types unchanged at both ends of the boundary", function () {
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true, "");
        H.link(H.add(graph, "constants/StringConstant"), 0, sub, 0);
        assert.strictEqual(input.properties.type, "java.lang.String");
        const output = pin(sub, false, "");
        H.link(H.add(sub.subgraph, "constants/NumberConstant"), 0, output, 0);
        assert.strictEqual(sub.outputs[0].type, "int");
        const second = pin(sub, true, "");
        const add = H.add(sub.subgraph, "arithmetic/Add");
        H.link(second, 0, add, 1);
        assert.strictEqual(second.properties.type, add.inputs[1].type);
        assert.strictEqual(sub.inputs[1].type, add.inputs[1].type);
    });
    it("survives serialize/configure and pickNodeKeys with independent nested copies", function () {
        graph.config.align_to_grid = true;
        const sub = H.add(graph, SUBGRAPH);
        const input = pin(sub, true, "java.lang.String");
        const log = H.add(sub.subgraph, "native/ConsoleLog");
        H.link(input, 0, log, 1);
        const nested = H.add(sub.subgraph, SUBGRAPH);
        H.add(nested.subgraph, "constants/StringConstant");
        const text = H.add(graph, "constants/StringConstant");
        H.link(text, 0, sub, 0);
        const saved = graph.serialize();
        saved.nodes = saved.nodes.map(pickNodeKeys);
        graph.configure(saved);
        const restored = graph.getNodeById(sub.id);
        assert.strictEqual(restored.subgraph._subgraph_node, restored);
        assert.strictEqual(restored.subgraph.config.align_to_grid, true);
        assert.strictEqual(restored.inputs[0].boundaryId, input.id);
        assert.strictEqual(restored.inputs[0].link, text.outputs[0].links[0]);
        assert.strictEqual(restored.subgraph.getNodeById(input.id).outputs[0].links.length, 1);
        const copy = restored.clone();
        assert.notStrictEqual(copy.subgraph, restored.subgraph);
        copy.subgraph.getNodeById(nested.id).subgraph._nodes[0].setProperty("string", "copy");
        assert.notStrictEqual(restored.subgraph.getNodeById(nested.id).subgraph._nodes[0].properties.string, "copy");
        assert.doesNotThrow(() => flattenGraph(graph));
    });
    it("drops unknown graph and node keys recursively", function () {
        const data = {id: 1, type: SUBGRAPH, subgraph: {nodes: [{id: 1, type: SUBGRAPH, onAdded: "bad", subgraph: {nodes: [{id: 1, type: "code/JavaCode", injected: true}], links: [], clear: "bad"}}], links: [], configure: "bad", _subgraph_node: "bad"}};
        const result = pickNodeKeys(data);
        assert.strictEqual(result.subgraph.configure, undefined);
        assert.strictEqual(result.subgraph._subgraph_node, undefined);
        assert.strictEqual(result.subgraph.nodes[0].onAdded, undefined);
        assert.strictEqual(result.subgraph.nodes[0].subgraph.clear, undefined);
        assert.strictEqual(result.subgraph.nodes[0].subgraph.nodes[0].injected, undefined);
        for (const subgraph of [null, [], "bad", new Date()]) assert.strictEqual(pickNodeKeys({subgraph}).subgraph, undefined);
        assert.strictEqual(data.subgraph.configure, "bad");
    });
    it("forwards inner changes to root history and restores them on undo", function () {
        const sub = H.add(graph, SUBGRAPH);
        const nested = H.add(sub.subgraph, SUBGRAPH);
        const history = new History();
        const track = () => history.track(JSON.stringify(graph.serialize()));
        const calls = [];
        for (const hook of ["onNodeAdded", "onNodeRemoved", "onConnectionChange", "onNodePropertyChanged", "onAfterChange", "onGetNodeMenuOptions"]) {
            graph[hook] = (...args) => { calls.push(hook); track(); };
        }
        track();
        const text = H.add(nested.subgraph, "constants/StringConstant");
        assert(calls.includes("onNodeAdded"));
        graph.configure(JSON.parse(history.undo()));
        const inner = graph.getNodeById(sub.id).subgraph.getNodeById(nested.id).subgraph;
        assert.strictEqual(inner.getNodeById(text.id), undefined);
        history.pause();
        for (const hook of ["onNodeRemoved", "onConnectionChange", "onNodePropertyChanged", "onAfterChange", "onGetNodeMenuOptions"]) inner[hook]();
        for (const hook of ["onNodeRemoved", "onConnectionChange", "onNodePropertyChanged", "onAfterChange", "onGetNodeMenuOptions"]) assert(calls.includes(hook));
    });
    it("maps a compile error inside generated Java to the original node path", async function () {
        const sub = H.add(graph, SUBGRAPH);
        const code = H.add(sub.subgraph, "code/JavaCode", {code: "missingMethod();"});
        const flat = flattenGraph(graph);
        const source = await H.gen(flat.graph);
        const line = source.split("\n").findIndex(line => line.includes("missingMethod();")) + 1;
        assert(line > 0);
        assert.deepStrictEqual(pathOf(flat.paths, nodeForLine(source, line)), [sub.id, code.id]);
    });
});
