// Stub Electron so the generators can run in plain Node.
const Module = require("module");
const path = require("path");
const REPO = path.resolve(__dirname, "../..");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === "electron") return {shell: {openExternal() {}}, app: null};
    if (request === "@electron/remote") return {app: null};
    return origLoad.apply(this, arguments);
};
const quiet = process.env.PB_VERBOSE ? null : console.log;
if (quiet) { console.log = () => {}; console.warn = () => {}; }
global.window = global;
global.Path2D = function () {};
const lg = require(path.join(REPO, "assets/lib/litegraph/litegraph"));
global.LiteGraph = lg.LiteGraph; global.LGraph = lg.LGraph; global.LGraphCanvas = lg.LGraphCanvas; global.LGraphNode = lg.LGraphNode;
const NodeGenerator = require(path.join(REPO, "js/nodeGenerator"));
const CodeGenerator = require(path.join(REPO, "js/codeGenerator"));

async function setup() {
    if (!global.__pbInit) { global.__pbInit = true; await NodeGenerator.init(); }
    const graph = new LGraph();
    graph.last_node_id = 1;
    global.graph = graph;
    return graph;
}
function add(graph, type, props) {
    const n = LiteGraph.createNode(type);
    if (!n) throw new Error("no node type " + type);
    graph.add(n);
    if (props) for (const k in props) { n.properties[k] = props[k]; if (n.onPropertyChanged) n.onPropertyChanged(k, props[k]); }
    return n;
}
function outIdx(n, name) { const i = n.outputs.findIndex(o => o.name === name); if (i < 0) throw new Error("no output " + name + " on " + n.type + ": " + n.outputs.map(o => o.name)); return i; }
function inIdx(n, name) { const i = n.inputs.findIndex(o => o.name === name); if (i < 0) throw new Error("no input " + name + " on " + n.type + ": " + n.inputs.map(o => o.name)); return i; }
// add an optional output (by name) to a node, like the right-click Outputs menu
function addOptOut(n, name) {
    const e = n.optional_outputs.find(o => o[0] === name);
    if (!e) throw new Error("no optional output " + name + " on " + n.type);
    n.addOutput(e[0], e[1], e[2]);
    return n.outputs.length - 1;
}
function addOptIn(n, name) {
    const e = n.optional_inputs.find(o => o[0] === name);
    if (!e) throw new Error("no optional input " + name);
    n.addInput(e[0], e[1], e[2]);
    return n.inputs.length - 1;
}
function link(a, aSlot, b, bSlot) {
    const as = typeof aSlot === "string" ? outIdx(a, aSlot) : aSlot;
    const bs = typeof bSlot === "string" ? inIdx(b, bSlot) : bSlot;
    const r = a.connect(as, b, bs);
    if (!r) throw new Error("connect refused: " + a.type + "[" + a.outputs[as].name + ":" + a.outputs[as].type + "] -> " + b.type + "[" + b.inputs[bs].name + ":" + String(b.inputs[bs].type).slice(0, 80) + "]");
    return r;
}
async function gen(graph, debug) {
    return CodeGenerator.generateClassCode(graph, {package: "my.awesome.plugin", debug: !!debug});
}
function loadSnippet(graph, snippet) {
    const data = LiteGraph.cloneObject(snippet);
    const newNodeIdMap = {};
    const newLinkIdMap = {};
    for (const n of data.nodes) {
        const newId = ++graph.last_node_id;
        newNodeIdMap[n.id] = newId;
        n.id = newId;
        const node = LiteGraph.createNode(n.type, n.title);
        if (!node) {
            console.warn("Unknown node: " + n.type);
            continue;
        }
        node.id = newId;
        graph.add(node, true);
    }
    for (const l of data.links) {
        const newId = ++graph.last_link_id;
        newLinkIdMap[l.id] = newId;
        graph.links[newId] = new LiteGraph.LLink(newId, l.type, newNodeIdMap[l.oId], l.oSlot, newNodeIdMap[l.tId], l.tSlot);
    }
    for (const n of data.nodes) {
        if (n.inputs) {
            for (const input of n.inputs) {
                if (input.link) input.link = newLinkIdMap[input.link];
            }
        }
        if (n.outputs) {
            for (const output of n.outputs) {
                if (output.links) output.links = output.links.map(id => newLinkIdMap[id]);
            }
        }
        const node = graph.getNodeById(n.id);
        if (node) node.configure(n);
    }
    for (const g of data.groups) {
        const group = new LiteGraph.LGraphGroup();
        group.configure(g);
        graph.add(group);
    }
    graph.updateExecutionOrder();
    graph._version++;
    graph.setDirtyCanvas(true, true);
}
module.exports = {setup, add, link, outIdx, inIdx, addOptOut, addOptIn, gen, loadSnippet, LiteGraph: () => LiteGraph, log: quiet || console.log};
