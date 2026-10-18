import {ipcRenderer, shell} from "electron";
import {app, getCurrentWindow} from "@electron/remote";
import setWindowMenu = require("../lib/windowMenu");
const {LiteGraph, LGraph, LGraphCanvas, LGraphNode} = require("../../assets/lib/litegraph/litegraph") as Omit<typeof import("../../assets/lib/litegraph/litegraph"), "LiteGraph" | "LGraph" | "LGraphCanvas"> & {
    LiteGraph: typeof import("../../assets/lib/litegraph/litegraph").LiteGraph & LiteGraphExtras & {
        createNode(type: string | null, title?: string | null): import("../../assets/lib/litegraph/litegraph").LGraphNode | null;
    };
    LGraph: {new(): PageGraph};
    LGraphCanvas: Pick<typeof import("../../assets/lib/litegraph/litegraph").LGraphCanvas, keyof typeof import("../../assets/lib/litegraph/litegraph").LGraphCanvas> & {
        new(canvas: string, graph: PageGraph): import("../../assets/lib/litegraph/litegraph").LGraphCanvas;
    };
};
Object.assign(window, {LiteGraph, LGraphCanvas});
import NodeGenerator = require("../lib/nodeGenerator");
import CodeGenerator = require("../lib/codeGenerator");
Object.assign(window, {CodeGenerator});
import History = require("../lib/history");
import $ = require("jquery");
const KeyPics = require("key.pics") as typeof import("key.pics");
import {updateLinkColors} from "../lib/util";
import type {LiteGraphExtras} from "../types/litegraph-augment";
import type {ProjectInfo, Snippet} from "../types/project";
import type {LGraphGroup, LGraphNode as GraphNode, LGraph as Graph} from "../../assets/lib/litegraph/litegraph";

type PageGraph = Pick<Graph, keyof Graph> & {
    _nodes: GraphNode[];
    _groups: LGraphGroup[];
    _version: number;
};

declare global {
    interface Window {
        LiteGraph: typeof LiteGraph;
        LGraphCanvas: typeof LGraphCanvas;
        graph: typeof graph;
        canvas: typeof canvas;
        projectInfo: Partial<ProjectInfo>;
        configureSnippet: typeof configureSnippet;
        serializeSnippet: typeof serializeSnippet;
        CodeGenerator: typeof CodeGenerator;
        generateCodeCompilePackage: typeof generateCodeCompilePackage;
    }
}

let theMenu = setWindowMenu([
    {
        label: "File",
        submenu: [
            {
                label: "New", click: () => {
                    ipcRenderer.send("showCreateNewProject");
                }
            },
            {
                label: "Open", click: () => {
                    ipcRenderer.send("showOpenProject");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Save",
                accelerator: "CommandOrControl+S",
                click: () => {
                    saveGraph()
                }
            },
            {
                type: "separator"
            },
            {
                label: "Export Project",
                click: () => {
                    ipcRenderer.send("showExportDialog");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Export Selection (Snippet)",
                click: () => {
                    $("#overlay").fadeIn();
                    ipcRenderer.send("exportSnippet", serializeSnippet());
                    $("#overlay").fadeOut();
                }
            },
            {
                label: "Import Snippet",
                click: () => {
                    ipcRenderer.send("showImportSnippet");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Close Project",
                click: () => {
                    saveGraphAndClose();
                }
            }
        ]
    },
    {
        label: "Edit",
        submenu: [
            {
                id: "undo",
                label: "Undo",
                accelerator: "CommandOrControl+Z",
                enabled: false,
                click: () => undo()
            },
            {
                id: "redo",
                label: "Redo",
                accelerator: process.platform === "darwin" ? "Shift+CommandOrControl+Z" : "CommandOrControl+Y",
                enabled: false,
                click: () => redo()
            },
            {
                label: "Find",
                accelerator: "CommandOrControl+F",
                click: () => openFind()
            },
            {
                type: "separator"
            },
            {
                label: "Edit Project Information", click: () => {
                    ipcRenderer.send("openProjectInfoEditor");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Close",
                click: () => {
                    saveGraphAndClose();
                }
            },
            ...(process.platform === "darwin" ? [
                {type: "separator"},
                {role: "cut"},
                {role: "copy"},
                {role: "paste"},
                {role: "selectAll"}
            ] : []) as import("electron").MenuItemConstructorOptions[]
        ]
    },
    {
        label: "View",
        submenu: [
            {
                label: "Focus on content", click: () => {
                    if (canvas && graph && graph._nodes.length > 0) {
                        canvas.centerOnNode(graph._nodes[0]);
                    }
                }
            },
            {
                type: "separator"
            },
            {
                role: "toggledevtools" as import("electron").MenuItemConstructorOptions["role"]
            }
        ]
    },
    {
        label: "Git",
        submenu: [
            {
                label: "Commit", click: () => {
                    $("#overlay").fadeIn();
                    ipcRenderer.send("gitAddAndCommit");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Push", click: () => {
                    $("#overlay").fadeIn();
                    ipcRenderer.send("gitPush");
                }
            },
            {
                label: "Change Remote", click: () => {
                    $("#overlay").fadeIn();
                    ipcRenderer.send("gitChangeRemote");
                }
            }
        ]
    },
    {
        label: "Compile",
        submenu: [
            {
                label: "Build & Reload",
                accelerator: "CommandOrControl+B",
                click: () => generateCodeCompilePackage("ifRunning")
            },
            {
                label: "Test",
                accelerator: "CommandOrControl+T",
                click: () => generateCodeCompilePackage("start")
            },
            {
                label: "Generate Code, Compile, Package", click: () => {
                    generateCodeCompilePackage();
                }
            },
            {
                type: "separator"
            },
            {
                label: "Open output directory", click: () => {
                    ipcRenderer.send("openOutputDir");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Generate Code", click: () => {
                    generateCode();
                }
            },
            {
                label: "Compile", click: () => {
                    compile();
                }
            },
            {
                label: "Package", click: () => {
                    pack();
                }
            }
        ]
    },
    {
        label: "Run",
        submenu: [
            {
                label: "Start Server", click: () => {
                    ipcRenderer.send("startServer");
                }
            },
            {
                id: "stopServer",
                label: "Stop",
                accelerator: "CommandOrControl+Shift+T",
                enabled: false,
                click: () => {
                    ipcRenderer.send("stopServer");
                }
            },
            {
                type: "separator"
            },
            {
                label: "Reload Plugin", click: () => {
                    ipcRenderer.send("reloadPlugin");
                }
            }
        ]
    },
    {
        label: "Help",
        submenu: [
            {
                label: "Install on your server",
                click: () => { shell.openExternal("https://pluginblueprint.net/wiki/Installing-on-your-Server"); }
            }
        ]
    }
]);

let projectInfo: Partial<ProjectInfo> = {};
Object.assign(window, {projectInfo});
let isNewProject: boolean | undefined = false;

let history = new History<string>();
Object.defineProperty(window, "history", {value: history, writable: true, configurable: true});
history.pause();

let unsavedChanges = 0;
let uncompiledChanges = 0;
let savingChanges: number | null = null;
let manualSavePending = false;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
ipcRenderer.send("setChangeState", {unsaved: unsavedChanges, uncompiled: uncompiledChanges});

var graph = new LGraph();
Object.assign(window, {graph});
if (!graph.config) graph.config = {};
(graph.config as {align_to_grid?: boolean}).align_to_grid = true;
graph.onNodeAdded = function (n) {
    console.debug("[HISTORY] onNodeAdded");
    if (n) {
        n.size = n.computeSize();
    }
    trackGraphChange();
    // hide inside the history's timeout to prevent hiding it instantly
    if (!history.paused) {
        $("#helpBox").hide();
    }
};
graph.onNodeRemoved = function (n) {
    console.debug("[HISTORY] onNodeRemoved");
    trackGraphChange();
};
graph.onConnectionChange = function () {
    console.debug("[HISTORY] onConnectionChange");
    trackGraphChange();
};
graph.onNodePropertyChanged = function () {
    console.debug("[HISTORY] onNodePropertyChanged");
    trackGraphChange();
};
graph.onAfterChange = function () {
    trackGraphChange();
};

function serializeHistory() {
    let data = graph.serialize();
    // Selecting a node brings it to the front without changing the project.
    data.nodes.sort((a, b) => a.id - b.id);
    return JSON.stringify(data);
}

function codeState(state: string | null | undefined) {
    if (!state) return state;
    let data: ReturnType<Graph["serialize"]> = JSON.parse(state);
    return JSON.stringify({...data, groups: [], nodes: data.nodes.map(({pos, size, title, ...node}) => node)});
}

function trackGraphChange() {
    let state = serializeHistory();
    let previous = history.present;
    if (!history.track(state)) return;
    markGraphChanged(codeState(previous) !== codeState(state));
    refreshHistoryState();
}

function markGraphChanged(codeChanged: boolean) {
    unsavedChanges++;
    if (codeChanged) uncompiledChanges++;
    ipcRenderer.send("setChangeState", {unsaved: unsavedChanges, uncompiled: uncompiledChanges});
    updateTitle();
    scheduleAutosave();
}

function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    if (unsavedChanges > 0) {
        autosaveTimer = setTimeout(() => {
            autosaveTimer = undefined;
            saveGraph(true);
        }, 30000);
    }
}

graph.onNodeConnectionChange = function (slotType, node, slot) {
    updateLinkColors(slotType, node, slot);
};

LGraphCanvas.search_limit = 100;
LiteGraph.NODE_TITLE_COLOR = "#d0d0d0";
LiteGraph.DEFAULT_GROUP_FONT_SIZE = 24;
LiteGraph.search_show_all_on_open = false;
var canvas = new LGraphCanvas("#mycanvas", graph);
Object.assign(window, {canvas});
canvas.allow_reconnect_links = false;
canvas.show_info = false;
canvas.onNodeMoved = () => trackGraphChange();
canvas.onShowNodePanel = function () {};
console.log(canvas);

ipcRenderer.send("getProjectInfo");

window.addEventListener("resize", function () {
    canvas.resize();
});
$("body")[0].addEventListener("keydown", function (event) {
    if (event.target instanceof HTMLElement &&
        (event.target.closest("button, select, textarea, input") || event.target.isContentEditable)) return;
    if (event.target !== canvas.canvas) {
        canvas.processKey(event);
    }
});
canvas.resize();

$("#saveGraph").on("click", () => saveGraph());
$("#buildReload").on("click", () => generateCodeCompilePackage("ifRunning"));
$("#testPlugin").on("click", () => generateCodeCompilePackage("start"));
$("#stopServer").on("click", () => ipcRenderer.send("stopServer"));
ipcRenderer.on("serverState", function (event, arg: {running: boolean}) {
    $("#stopServer").prop("disabled", !arg.running);
    $("#testPlugin").text(arg.running ? "Restart" : "Test");
    theMenu.getMenuItemById("stopServer")!.enabled = arg.running;
});
ipcRenderer.send("getServerState");

const findInput = document.querySelector<HTMLInputElement>("#findInput")!;
let findMatches: GraphNode[] = [];
let findIndex = -1;

function openFind() {
    $("#findBox").prop("hidden", false);
    findInput.focus();
    findInput.select();
    findNodes();
}

function findNodes() {
    let query = findInput.value.toLowerCase();
    findMatches = query ? graph._nodes.filter(node =>
        node.title.toLowerCase().includes(query) || (node.type || "").toLowerCase().includes(query)) : [];
    findIndex = findMatches.length ? 0 : -1;
    showFindMatch();
}

function showFindMatch() {
    $("#findCount").text((findIndex + 1) + " of " + findMatches.length);
    let node = findMatches[findIndex];
    if (node) {
        canvas.selectNode(node);
        canvas.centerOnNode(node);
    }
}

findInput.addEventListener("input", findNodes);
findInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        $("#findBox").prop("hidden", true);
        canvas.canvas.focus();
    } else if (event.key === "Enter") {
        if (findMatches.length) {
            findIndex = (findIndex + (event.shiftKey ? -1 : 1) + findMatches.length) % findMatches.length;
            showFindMatch();
        }
    } else return;
    event.preventDefault();
    event.stopPropagation();
});


function addBukkitNode(className: string, classType: unknown) {
    let nodeName = (NodeGenerator.getOrCreateBukkitClassNode as (className: string, classType: unknown) => ReturnType<typeof NodeGenerator.getOrCreateBukkitClassNode>)(className, classType);
    console.log(nodeName);
    if (!nodeName) return;
    let node = LiteGraph.createNode(nodeName);
    if (!node) return;
    console.log(node);
    graph.add(node);
}

function generateCode() {
    $("#overlay").fadeIn();
    CodeGenerator.generateClassCode(graph, projectInfo as ProjectInfo).then((code) => {
        ipcRenderer.send("codeGenerated", {code: code, compile: false, pack: false});
    });
}


function generateCodeCompilePackage(reload?: "ifRunning" | "start") {
    $("#overlay").fadeIn();
    CodeGenerator.generateClassCode(graph, projectInfo as ProjectInfo).then((code) => {
        ipcRenderer.send("codeGenerated", {code: code, compile: true, pack: true, ...(reload ? {reload} : {})});
    });
}


Object.assign(window, {generateCodeCompilePackage});

function compile() {
    $("#overlay").fadeIn();
    ipcRenderer.send("codeGenerated", {code: null, compile: true, pack: false});
}

function pack() {
    $("#overlay").fadeIn();
    ipcRenderer.send("codeGenerated", {code: null, compile: false, pack: true});
}

function saveGraph(autosave = false) {
    if (savingChanges !== null) {
        if (!autosave) manualSavePending = true;
        return;
    }
    if (autosave && unsavedChanges === 0) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
    savingChanges = unsavedChanges;
    updateTitle();
    if (!autosave) {
        $("#overlay").fadeIn();
        makeThumbnail();
    }
    let data = graph.serialize();
    ipcRenderer.send("saveGraphData", autosave ? {...data, autosave: true} : data);
}

function saveGraphAndClose() {
    $("#overlay").fadeIn();
    makeThumbnail();
    ipcRenderer.send("saveGraphDataAndClose", graph.serialize());
}

function makeThumbnail() {
    let img = canvas.canvas.toDataURL("image/jpeg");
    ipcRenderer.send("saveThumbnail", img);
}

function undo() {
    console.log("canUndo: " + history.canUndo());
    history.pause();
    if (history.canUndo()) {
        let previous = history.present;
        let undone = history.undo();
        console.log(undone);
        graph.configure(JSON.parse(undone!))
        markGraphChanged(codeState(previous) !== codeState(undone));
    }
    history.unpause();
    console.log(history);

    refreshHistoryState();
}

function redo() {
    console.log("canRedo: " + history.canRedo());
    history.pause();
    if (history.canRedo()) {
        let previous = history.present;
        let redone = history.redo();
        console.log(redone);
        graph.configure(JSON.parse(redone!));
        markGraphChanged(codeState(previous) !== codeState(redone));
    }
    history.unpause();
    console.log(history);

    refreshHistoryState();
}

function refreshHistoryState() {
    theMenu.getMenuItemById("undo")!.enabled = history.canUndo();
    theMenu.getMenuItemById("redo")!.enabled = history.canRedo();
}

function serializeSnippet(): Snippet {
    let nodeIds = [];
    let nodePositions = [];
    let nodes = [];
    let links = [];
    for (let i in canvas.selected_nodes) {
        let n = LiteGraph.cloneObject(canvas.selected_nodes[i].serialize());

        nodePositions.push([n.pos[0], n.pos[1]]);
        n.pos[0] -= canvas.visible_area[0];
        n.pos[1] -= canvas.visible_area[1];

        nodeIds.push(n.id);
        nodes.push(n);
    }
    for (let l in graph.links) {
        let link = graph.links[l];
        if (nodeIds.indexOf(link.origin_id) >= 0 && nodeIds.indexOf(link.target_id) >= 0) {
            links.push({
                id: link.id,
                oId: link.origin_id,
                oSlot: link.origin_slot,
                tId: link.target_id,
                tSlot: link.target_slot,
                type: link.type
            })
        }
    }

    let groups = [];
    for (let i = 0; i < graph._groups.length; i++) {
        let g = graph._groups[i];
        let include = false;
        for (let j = 0; j < nodePositions.length; j++) {
            if (g.isPointInside(nodePositions[j][0], nodePositions[j][1])) {
                include = true;
                break;
            }
        }
        if (include) {
            let serialized = LiteGraph.cloneObject(g.serialize());
            serialized.bounding[0] -= canvas.visible_area[0];
            serialized.bounding[1] -= canvas.visible_area[1];
            groups.push(serialized);
        }
    }

    console.debug("Exporting", nodes.length, "nodes,", groups.length, "groups and", links.length, "links");

    return {
        nodes: nodes,
        links: links,
        groups: groups,
        zoom: canvas.ds.scale
    }
}

Object.assign(window, {serializeSnippet});

function configureSnippet(data: Snippet) {
    $("#overlay").fadeIn();

    history.track(serializeHistory());
    history.pause();
    canvas.deselectAllNodes();

    if (data.zoom) {
        canvas.setZoom(data.zoom);
    }

    let newNodeIdMap: Record<number, number> = {};
    let newLinkIdMap: Record<number, number> = {};
    for (let i = 0; i < data.nodes.length; i++) {
        let n = data.nodes[i];

        let newId = ++graph.last_node_id;
        newNodeIdMap[n.id] = newId;
        n.id = newId;

        let node = LiteGraph.createNode(n.type, n.title);
        if (!node) {
            console.warn("Unknown node: " + n.type);
            continue;
        }
        node.id = newId;

        console.log(node);
        graph.add(node, true);
    }
    for (let j = 0; j < data.links.length; j++) {
        let l = data.links[j];

        let newId = ++graph.last_link_id;
        newLinkIdMap[l.id] = newId;
        graph.links[newId] = new LiteGraph.LLink(newId, l.type as string, newNodeIdMap[l.oId], l.oSlot, newNodeIdMap[l.tId], l.tSlot);
    }
    for (let i = 0; i < data.nodes.length; i++) {
        let n = data.nodes[i];
        if (n.inputs) {
            for (let j = 0; j < n.inputs.length; j++) {
                if (n.inputs[j].link) {
                    n.inputs[j].link = newLinkIdMap[n.inputs[j].link!];
                }
            }
        }
        if (n.outputs) {
            for (let j = 0; j < n.outputs.length; j++) {
                if (n.outputs[j].links) {
                    for (let k = 0; k < n.outputs[j].links!.length; k++) {
                        n.outputs[j].links![k] = newLinkIdMap[n.outputs[j].links![k]]
                    }
                }
            }
        }

        if (n.pos) {
            n.pos[0] += canvas.visible_area[0];
            n.pos[1] += canvas.visible_area[1];
        }

        let node = graph.getNodeById(n.id);
        if (node) {
            node.configure(n);
            canvas.selectNode(node, true);
        }
    }

    for (let i = 0; i < data.groups.length; i++) {
        let g = data.groups[i];
        if (g.bounding) {
            g.bounding[0] += canvas.visible_area[0];
            g.bounding[1] += canvas.visible_area[1];
        }
        let group = new LiteGraph.LGraphGroup();
        group.configure(g);
        graph.add(group);
    }

    graph.updateExecutionOrder();
    graph._version++;
    graph.setDirtyCanvas(true, true);

    history.unpause();
    trackGraphChange();

    $("#overlay").fadeOut();
}

Object.assign(window, {configureSnippet});

let nodesInitialized = false;
ipcRenderer.on("projectInfo", function (event, arg: ProjectInfo) {
    projectInfo = arg;
    Object.assign(window, {projectInfo});
    isNewProject = projectInfo.isNewProject;
    delete projectInfo.isNewProject;
    console.log("Project:");
    console.log(arg);
    console.log("Is New:", isNewProject);


    if (!nodesInitialized) {
        console.log("Initializing Bukkit Node generator...");
        NodeGenerator.init().then(() => {
            nodesInitialized = true;
            ipcRenderer.send("getGraphData");

            graph.start(100);
        });
    }
});
ipcRenderer.on("graphData", function (event, arg: ReturnType<Graph["serialize"]> | null) {
    if (!arg) {
        console.warn("Empty graph data");
    }
    if (graph && arg && arg.nodes) {
        graph.configure(arg);
    }
    $("#overlay").fadeOut();

    history.unpause();
    history.track(serializeHistory());
    refreshHistoryState();
});
ipcRenderer.on("generateDone", function (event, arg) {
    $("#overlay").fadeOut();
    uncompiledChanges = 0;
    ipcRenderer.send("setChangeState", {uncompiled: uncompiledChanges});

    for (let i = 0; i < graph._nodes.length; i++) {
        delete graph._nodes[i].has_errors;
    }
});
ipcRenderer.on("generateError", function (event, arg: string | Error) {
    $("#overlay").fadeOut();
    console.error(arg);

    highlightAffectedNodes(arg, true);
});
ipcRenderer.on("graphDataSaved", function (event, arg) {
    $("#overlay").fadeOut();
    unsavedChanges = Math.max(0, unsavedChanges - (savingChanges ?? unsavedChanges));
    savingChanges = null;
    ipcRenderer.send("setChangeState", {unsaved: unsavedChanges});
    updateTitle();
    if (manualSavePending) {
        manualSavePending = false;
        saveGraph();
    } else if (autosaveTimer === undefined) scheduleAutosave();
});

ipcRenderer.on("logError", function (event, arg: string) {
    console.log("logError", arg);

    highlightAffectedNodes(arg, false);
});

ipcRenderer.on("importSnippet", function (event, arg: Snippet) {
    if (history) {
        history.track(serializeHistory());
    }
    configureSnippet(arg);
});

ipcRenderer.on("committed", function (event, arg) {
    $("#overlay").fadeOut();
});
ipcRenderer.on("remoteChanged", function (event, arg) {
    $("#overlay").fadeOut();
});
ipcRenderer.on("pushed", function (event, arg) {
    $("#overlay").fadeOut();
});


function highlightAffectedNodes(arg: string | Error, deselectFirst: boolean) {
    let affectedNode = /node_([0-9]+)/gm.exec(arg as string);
    console.log(affectedNode);

    if (deselectFirst) {
        for (let i = 0; i < graph._nodes.length; i++) {
            delete graph._nodes[i].has_errors;
        }
    }
    if (affectedNode) {
        let n = graph.getNodeById(parseInt(affectedNode[1]));
        if (n) {
            n.has_errors = true;
        }
    }
}

function updateTitle() {
    $("#saveState").text(savingChanges !== null ? "Saving…" : unsavedChanges > 0 ? "Unsaved changes" : "Saved");
    getCurrentWindow().setTitle("PluginBlueprint Editor [" + projectInfo.name + (unsavedChanges > 0 && uncompiledChanges > 0 ? "**" : (unsavedChanges > 0 || uncompiledChanges > 0 ? "*" : "")) + "]");
}

ipcRenderer.on("debugCall", function (event, arg: {node: number; type: string}) {
    console.log("debugCall", arg);
    let node = graph.getNodeById(arg.node);
    if (node) {
        console.log(node);
        if (arg.type === "exec") {
            if (node.inputs) {
                // Trace back the inputs, since the node calls the debug on itself, but litegraph wants the trigger on the originating node
                for (let i = 0; i < node.inputs.length; i++) {
                    let input = node.inputs[i];
                    console.log(input);
                    if (!input) continue;
                    if (input.type === "@EXEC") {
                        let linkInfo = input.link ? graph.links[input.link] : null;
                        if (linkInfo) {
                            let originNode = graph.getNodeById(linkInfo.origin_id);
                            if (originNode) {
                                console.log("Trigger slot", linkInfo.origin_slot, "in node", linkInfo.origin_id, " - triggered by", node.id);
                                originNode.triggerSlot(linkInfo.origin_slot);
                            }
                        }
                    }
                }
            }
            // if (node.outputs) {
            //     for (let o = 0; o < node.outputs.length; o++) {
            //         if (node.outputs[o].type === "@EXEC") {
            //             node.triggerSlot(o)
            //         }
            //     }
            // }
        }
    }
});

ipcRenderer.on("highlightNode", function (event, arg: {node: number}) {
    let node = graph.getNodeById(arg.node);
    if (node) {
        console.log(node);
        canvas.selectNode(node);
        canvas.centerOnNode(node);
        canvas.setZoom(2);
    }
});

// HelpBox timeout
setTimeout(function () {
    $("#helpBox").hide();
}, 60000);
