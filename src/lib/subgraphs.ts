import {LGraph, LiteGraph, type LGraphCanvas, type LGraphNode, type SerializedLGraphNode, type serializedLGraph} from "../../assets/lib/litegraph/litegraph";
import {graphIdProblems, SourceError} from "./sourceChecks";
import {shapeAndColorsForSlotType} from "./util";
import type {Problem} from "./graphValidator";
import type {LiteGraphExtras} from "../types/litegraph-augment";

export const SUBGRAPH = "graph/Subgraph", SUBGRAPH_INPUT = "graph/SubgraphInput", SUBGRAPH_OUTPUT = "graph/SubgraphOutput";
export type NodePath = number[];
export interface FlatGraph { graph: LGraph; paths: Map<number, NodePath>; }
type GraphNodes = Pick<LGraph, keyof LGraph> & {_nodes: LGraphNode[]};
type NodeData = SerializedLGraphNode & {subgraph?: serializedLGraph<NodeData>};
type LinkData = {id: number; oId: number; oSlot: number; tId: number; tSlot: number; type: string};
const cloneObject = (LiteGraph as typeof LiteGraph & LiteGraphExtras).cloneObject;
const isBoundary = (type: string | null) => type === SUBGRAPH_INPUT || type === SUBGRAPH_OUTPUT;

export function hasSubgraphs(graph: Pick<GraphNodes, "_nodes"> | LGraph): boolean {
    return (graph as unknown as GraphNodes)._nodes.some(node => node.type === SUBGRAPH || isBoundary(node.type));
}

export function pathOf(paths: Map<number, NodePath>, id: number): NodePath {
    return paths.get(id) ?? [id];
}

export function eachGraph(root: LGraph, visit: (graph: LGraph, path: NodePath) => void): void {
    function walk(graph: LGraph, path: NodePath) {
        visit(graph, path);
        for (const node of (graph as unknown as GraphNodes)._nodes) {
            if (node.type === SUBGRAPH && node.subgraph) walk(node.subgraph, [...path, node.id]);
        }
    }
    walk(root, []);
}

export function resolvePath(root: LGraph, path: NodePath): LGraphNode | undefined {
    let graph = root;
    for (let i = 0; i < path.length; i++) {
        const node = graph.getNodeById(path[i]);
        if (!node) return;
        if (i === path.length - 1) return node;
        if (node.type !== SUBGRAPH || !node.subgraph) return;
        graph = node.subgraph;
    }
}

export function canvasPath(canvas: LGraphCanvas): NodePath {
    const path: NodePath = [];
    for (let graph = canvas.graph; graph?._subgraph_node; graph = graph._subgraph_node.graph!) path.unshift(graph._subgraph_node.id);
    return path;
}

export function subgraphProblems(root: LGraph): Problem[] {
    const problems: Problem[] = [];
    eachGraph(root, (graph, path) => {
        const add = (severity: Problem["severity"], nodePath: NodePath, message: string) =>
            problems.push({severity, nodeId: nodePath[0], path: nodePath, message});
        if (path.length) {
            for (const problem of graphIdProblems(graph as unknown as GraphNodes)) {
                add("error", problem.nodeId === undefined ? path : [...path, problem.nodeId], problem.message);
            }
        }
        const nodes = (graph as unknown as GraphNodes)._nodes;
        for (const node of nodes) {
            if (isBoundary(node.type)) {
                const nodePath = [...path, node.id];
                if (!path.length) add("error", nodePath, `"${node.title}" must be inside a subgraph. Move it into a subgraph or delete it.`);
                const type = node.properties.type;
                if (typeof type !== "string") {
                    add("error", nodePath, `The pin type on "${node.title}" must be text. Set the boundary node's type to a slot type such as int or @EXEC.`);
                }
                if (nodes.some(other => other !== node && other.type === node.type && other.id < node.id && other.properties.name === node.properties.name)) {
                    add("warning", nodePath, `More than one pin is named "${node.properties.name}". Give each pin a different name.`);
                }
            }
            if (node.type !== SUBGRAPH || !node.subgraph) continue;
            for (const [slots, type] of [[node.inputs, SUBGRAPH_INPUT], [node.outputs, SUBGRAPH_OUTPUT]] as const) {
                const seen = new Set<number>();
                for (const slot of slots || []) {
                    const id = slot.boundaryId;
                    if (id === undefined || node.subgraph.getNodeById(id)?.type !== type || seen.has(id)) {
                        add("error", [...path, node.id], `A pin on "${node.title}" has a missing, wrong-kind or duplicate boundaryId. Delete the pin's boundary node and add it again.`);
                    }
                    if (id !== undefined) seen.add(id);
                }
            }
        }
    });
    return problems;
}

function readLinks(data: serializedLGraph): LinkData[] {
    return data.links.map(([id, oId, oSlot, tId, tSlot, type]) => ({id, oId, oSlot, tId, tSlot, type}));
}

function writeLinks(links: LinkData[]): serializedLGraph["links"] {
    return links.map(({id, oId, oSlot, tId, tSlot, type}) => [id, oId, oSlot, tId, tSlot, type]);
}

export function flattenGraph(root: LGraph): FlatGraph {
    if (!hasSubgraphs(root)) return {graph: root, paths: new Map()};
    eachGraph(root, (graph, path) => {
        const problem = graphIdProblems(graph as unknown as GraphNodes)[0];
        if (problem) throw new SourceError(problem.message, undefined, problem.nodeId === undefined ? path : [...path, problem.nodeId]);
    });
    const badPin = subgraphProblems(root).find(problem => problem.message.includes("boundaryId"));
    if (badPin) throw new SourceError(badPin.message, undefined, badPin.path);
    const data = cloneObject(root.serialize<serializedLGraph<NodeData>>());
    let nodes = data.nodes;
    let links = readLinks(data);
    let nextNode = Math.max(data.last_node_id, ...nodes.map(node => node.id));
    let nextLink = Math.max(data.last_link_id, ...links.map(link => link.id));
    const paths = new Map(nodes.map(node => [node.id, [node.id]]));
    const nodeById = (id: number) => nodes.find(node => node.id === id)!;
    function removeLink(id: number) {
        const link = links.find(link => link.id === id);
        if (!link) return;
        const output = nodeById(link.oId)?.outputs?.[link.oSlot];
        if (output?.links) output.links = output.links.filter(value => value !== id);
        const input = nodeById(link.tId)?.inputs?.[link.tSlot];
        if (input?.link === id) input.link = null;
        links = links.filter(link => link.id !== id);
    }
    function spliceLinks(source: LinkData, targets: LinkData[]) {
        const output = nodeById(source.oId).outputs[source.oSlot];
        output.links!.splice(output.links!.indexOf(source.id), 1, ...targets.map(link => link.id));
        for (const link of targets) Object.assign(link, {oId: source.oId, oSlot: source.oSlot});
        removeLink(source.id);
    }
    let index: number;
    while ((index = nodes.findIndex(node => node.type === SUBGRAPH)) !== -1) {
        const sub = nodes[index];
        const inner = sub.subgraph!;
        const innerNodes = inner.nodes.sort((a, b) => a.id - b.id);
        const nodeIds = new Map<number, number>();
        const linkIds = new Map<number, number>();
        for (const node of innerNodes) {
            const id = ++nextNode;
            nodeIds.set(node.id, id);
            paths.set(id, [...paths.get(sub.id)!, node.id]);
            node.id = id;
        }
        const innerLinks = readLinks(inner);
        for (const link of innerLinks) {
            linkIds.set(link.id, ++nextLink);
            Object.assign(link, {id: nextLink, oId: nodeIds.get(link.oId)!, tId: nodeIds.get(link.tId)!});
        }
        for (const node of innerNodes) {
            for (const input of node.inputs || []) if (input.link != null) input.link = linkIds.get(input.link)!;
            for (const output of node.outputs || []) if (output.links) output.links = output.links.map(id => linkIds.get(id)!);
        }
        nodes.splice(index, 0, ...innerNodes);
        links.push(...innerLinks);
        for (const [k, pin] of (sub.inputs || []).entries()) {
            const boundary = nodeById(nodeIds.get(pin.boundaryId!)!);
            const targets = (boundary.outputs[0].links || []).map(id => links.find(link => link.id === id)!);
            const outer = links.find(link => link.tId === sub.id && link.tSlot === k);
            if (outer) spliceLinks(outer, targets);
            else for (const link of targets) removeLink(link.id);
        }
        for (const [k, pin] of (sub.outputs || []).entries()) {
            const boundary = nodeById(nodeIds.get(pin.boundaryId!)!);
            const innerLink = links.find(link => link.id === boundary.inputs[0].link);
            const targets = (pin.links || []).map(id => links.find(link => link.id === id)!);
            if (innerLink) spliceLinks(innerLink, targets);
            else for (const link of targets) removeLink(link.id);
        }
        const removed = new Set([sub.id, ...innerNodes.filter(node => isBoundary(node.type)).map(node => node.id)]);
        for (const link of [...links]) if (removed.has(link.oId) || removed.has(link.tId)) removeLink(link.id);
        nodes = nodes.filter(node => !removed.has(node.id));
        for (const id of removed) paths.delete(id);
    }
    const boundaries = new Set(nodes.filter(node => isBoundary(node.type)).map(node => node.id));
    for (const link of [...links]) if (boundaries.has(link.oId) || boundaries.has(link.tId)) removeLink(link.id);
    nodes = nodes.filter(node => !boundaries.has(node.id));
    for (const id of boundaries) paths.delete(id);
    const graph = new LGraph();
    graph.configure({...data, nodes, links: writeLinks(links), groups: [], last_node_id: nextNode, last_link_id: nextLink});
    return {graph, paths};
}

export function convertToSubgraph(graph: LGraph, nodeIds: number[]): number {
    const data = cloneObject(graph.serialize<serializedLGraph<NodeData>>());
    const selected = new Set(nodeIds);
    const nodes = data.nodes.filter(node => selected.has(node.id));
    const links = readLinks(data);
    const internal = links.filter(link => selected.has(link.oId) && selected.has(link.tId));
    const incoming = links.filter(link => !selected.has(link.oId) && selected.has(link.tId));
    const outgoing = links.filter(link => selected.has(link.oId) && !selected.has(link.tId));
    const sub = LiteGraph.createNode(SUBGRAPH)!.serialize() as NodeData;
    sub.id = ++data.last_node_id;
    sub.pos = [Math.min(...nodes.map(node => node.pos[0])), Math.min(...nodes.map(node => node.pos[1]))];
    const inner = sub.subgraph!;
    inner.nodes = nodes;
    inner.last_node_id = Math.max(0, ...nodes.map(node => node.id));
    inner.last_link_id = Math.max(0, ...links.filter(link => selected.has(link.oId) || selected.has(link.tId)).map(link => link.id));
    const outerLinks = links.filter(link => !selected.has(link.tId));
    const nodeById = (id: number) => data.nodes.find(node => node.id === id)!;
    function groups(crossing: LinkData[]): LinkData[][] {
        const grouped = new Map<string, LinkData[]>();
        for (const link of crossing.sort((a, b) => a.id - b.id)) {
            const key = `${link.oId}:${link.oSlot}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(link);
        }
        return [...grouped.values()];
    }
    for (const input of [true, false]) {
        for (const group of groups(input ? incoming : outgoing)) {
            const first = group[0];
            const origin = nodeById(first.oId);
            const output = origin.outputs[first.oSlot];
            const type = typeof output.type === "string" ? output.type : "";
            const boundary = LiteGraph.createNode(input ? SUBGRAPH_INPUT : SUBGRAPH_OUTPUT)!.serialize();
            boundary.id = ++inner.last_node_id;
            boundary.properties = {name: output.name, type};
            boundary.pos = [sub.pos[0] + (input ? -220 : 320), sub.pos[1] + (input ? sub.inputs.length : sub.outputs.length) * 80];
            const pin = {name: output.name, type, ...shapeAndColorsForSlotType(type, {boundaryId: boundary.id, nameLocked: true, locked: true})};
            const ids = new Set(group.map(link => link.id));
            const replacement: LinkData = {id: input ? ++data.last_link_id : ++inner.last_link_id, oId: origin.id, oSlot: first.oSlot,
                tId: input ? sub.id : boundary.id, tSlot: input ? sub.inputs.length : 0, type};
            output.links = output.links!.flatMap(id => id === first.id ? [replacement.id] : ids.has(id) ? [] : [id]);
            if (input) {
                sub.inputs.push({...pin, link: replacement.id});
                boundary.outputs[0] = {...boundary.outputs[0], name: output.name, type, links: group.map(link => link.id)};
                for (const link of group) Object.assign(link, {oId: boundary.id, oSlot: 0});
                internal.push(...group);
                outerLinks.push(replacement);
            } else {
                boundary.inputs[0] = {...boundary.inputs[0], name: output.name, type, link: replacement.id};
                const slot = sub.outputs.length;
                sub.outputs.push({...pin, links: group.map(link => link.id)});
                for (const link of group) Object.assign(link, {oId: sub.id, oSlot: slot});
                internal.push(replacement);
            }
            inner.nodes.push(boundary);
        }
    }
    inner.links = writeLinks(internal);
    const index = data.nodes.findIndex(node => selected.has(node.id));
    data.nodes = data.nodes.filter(node => !selected.has(node.id));
    data.nodes.splice(index, 0, sub);
    data.links = writeLinks(outerLinks);
    const owner = graph._subgraph_node;
    if (owner) owner._syncPaused = true;
    try {
        graph.configure(data);
    } finally {
        if (owner) owner._syncPaused = false;
    }
    owner?.syncSlots();
    return sub.id;
}
