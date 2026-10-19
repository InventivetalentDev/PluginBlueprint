import {LiteGraph, LGraph, LGraphNode} from "../../assets/lib/litegraph/litegraph";
import ClassDataStore = require("./classDataStore");
import {parseTypeSwitchEnum} from "./util";
import {graphIdProblems, propertyProblems, SourceError} from "./sourceChecks";
import {flattenGraph, pathOf, subgraphProblems, type NodePath} from "./subgraphs";
import type {ProjectInfo} from "../types/project";

export interface Problem { severity: "error" | "warning"; nodeId?: number; path?: NodePath; message: string; }

type ValidationProjectInfo = Partial<Pick<ProjectInfo, "commands" | "config">>;
type ValidationNode = LGraphNode & {
    nodeType?: string;
    classType?: string;
    className?: string;
    methodSignature?: string;
};
interface ValidationGraph extends Pick<LGraph, "links" | "getNodeById"> { _nodes: ValidationNode[]; }
export const classStore = new ClassDataStore();
const primitives = new Set(["boolean", "byte", "char", "short", "int", "long", "float", "double"]);

function needsNativeInput(graph: Pick<LGraph, "links" | "getNodeById">, node: ValidationNode, index: number): boolean {
    if (/^(arithmetic|relational|logic)\//.test(node.type || "")) return true;
    switch (node.type) {
        case "native/ConsoleLog":
        case "flow/ForLoop":
        case "arrays/GetIndex":
        case "arrays/Length": return true;
        case "native/StringFormat": return index === 1;
        case "native/Cast": return primitives.has(node.properties.castTo);
        case "variables/Set": return primitives.has(parseTypeSwitchEnum(node.properties.type));
        case "arrays/MakeArray":
            // join() leaves a blank element; only an empty array or a trailing comma is valid Java.
            return index < node.inputs.length - 1;
        case "arrays/SetIndex": {
            if (index < 3) return true;
            const arrayLink = graph.links[node.inputs[1]?.link!];
            const arrayType = arrayLink && graph.getNodeById(arrayLink.origin_id)?.outputs?.[arrayLink.origin_slot]?.type;
            return typeof arrayType === "string" && primitives.has(arrayType.replace(/\[\]$/, ""));
        }
        default: return false;
    }
}

export function validateGraph(graph: LGraph | ValidationGraph, projectInfo: ValidationProjectInfo): Problem[] {
    const problems: Problem[] = [];
    const nodes = (graph as ValidationGraph)._nodes;
    const add = (severity: Problem["severity"], node: LGraphNode | undefined, message: string) => {
        problems.push({severity, ...(node ? {nodeId: node.id} : {}), message});
    };

    for (const problem of graphIdProblems(graph as ValidationGraph)) problems.push({severity: "error", ...problem});

    for (const link of Object.values(graph.links)) {
        if (!link) continue;
        const origin = graph.getNodeById(link.origin_id);
        const target = graph.getNodeById(link.target_id);
        const output = origin?.outputs?.[link.origin_slot];
        const input = target?.inputs?.[link.target_slot];
        if (!origin || !target || !output || !input || !output.links?.includes(link.id) || input.link !== link.id) {
            const node = target || origin;
            add("error", node, `A connection${node ? ` on "${node.title}"` : ""} points to a missing node or slot, or no longer matches its slots. Delete the connection and connect it again.`);
        }
    }

    const variables = new Map<string, {type: string; node: ValidationNode}>();
    const commands = new Map<string, ValidationNode>();
    for (const node of nodes) {
        if (!node.type || !Object.hasOwn(LiteGraph.registered_node_types, node.type)) {
            add("error", node, `PluginBlueprint doesn't know the node type "${node.type}" on "${node.title}". It may come from a newer version. Delete the node.`);
            continue;
        }

        for (const problem of propertyProblems(node, classStore)) add("error", node, problem.message);

        if (node.classType === "native") {
            for (const output of node.outputs || []) {
                if (output.type === "@EXEC" && output.links?.some(id => !graph.links[id])) {
                    add("error", node, `The "${output.name}" output of "${node.title}" points to a connection that no longer exists. Delete the connection and connect it again.`);
                }
            }
        }

        const ref = node.inputs?.find(input => input.name === "REF");
        const method = classStore.getMethod(node.className, node.methodSignature);
        if ((node.nodeType === "BukkitMethodNode" || node.nodeType === "BukkitAbstractMethodNode") && method && !method.isStatic && ref?.link == null) {
            add("error", node, `Connect the REF input of "${node.title}" to the object it should run on, for example a Player.`);
        }

        for (const [index, input] of (node.inputs || []).entries()) {
            if (input.link != null && !graph.links[input.link]) {
                add("error", node, `The "${input.name}" input of "${node.title}" points to a connection that no longer exists. Delete the connection and connect it again.`);
            }
            if (input.link != null || input.type === "@EXEC" || input.name === "REF") continue;
            if (needsNativeInput(graph, node, index)) {
                add("error", node, `Connect the "${input.label || input.name || "value"}" input of "${node.title}".`);
            }
            if (input.paramIndex !== undefined) {
                const type = String(input.type).split(",")[0];
                const fallback = type === "boolean" ? "false" : primitives.has(type) ? "0" : "null";
                add("warning", node, `The "${input.name}" input of "${node.title}" isn't connected, so it gets ${fallback}. Connect it if you need a value.`);
            }
        }

        // An object used only for static methods does not need an execution chain.
        const linkedOutputs = (node.outputs || []).filter(output => output.links?.length);
        const staticOnly = node.nodeType === "BukkitClassNode" && ref?.link == null && linkedOutputs.length > 0 &&
            linkedOutputs.every(output =>
                output.linkType === "staticMethod" || !!classStore.getMethod(output.className, output.methodSignature)?.isStatic);
        if (!staticOnly && node.inputs?.some(input => input.type === "@EXEC" && input.link == null)) {
            add("warning", node, `"${node.title}" never runs: connect its EXEC input.`);
        }

        for (const slot of [...(node.inputs || []), ...(node.outputs || [])]) {
            const linked = "links" in slot ? !!slot.links?.length : "link" in slot && slot.link != null;
            const type = typeof slot.type === "string" ? slot.type.split(",")[0] : "";
            if (linked && /^[A-Z][A-Za-z0-9_]*$/.test(type) && !classStore.getClass(type)) {
                add("error", node, `The "${slot.name}" slot of "${node.title}" has a generic type (${type}) the generator can't use yet. Remove this connection.`);
            }
        }
        for (const output of node.outputs || []) {
            if ((node.classType === "object" || node.classType === "event") && output.links?.length && output.linkType === "method" && !String(output.type).includes("#")) {
                add("error", node, `The "${output.name}" output of "${node.title}" has a type the generator can't use yet. Remove this connection and use a method node instead.`);
            }
        }

        const clazz = classStore.getClass(node.className);
        if (node.nodeType === "BukkitClassNode" && clazz && !clazz.isEvent &&
            classStore.isAssignableTo(clazz.qualifiedName, "org.bukkit.event.Event") && ref?.link == null) {
            add("error", node, `"${node.title}" can't be listened to. Use a specific event such as PlayerJoinEvent.`);
        }

        if (node.type === "variables/Set" || node.type === "variables/Get") {
            const name = String(node.properties.name ?? "");
            const type = parseTypeSwitchEnum(node.properties.type);
            const previous = variables.get(name);
            if (previous && previous.type !== type) {
                const message = `The variable "${name}" on "${previous.node.title}" and "${node.title}" is used as ${previous.type} and as ${type}. Use one type, or rename one of them.`;
                add("error", previous.node, message);
                add("error", node, message);
            } else if (!previous) variables.set(name, {type, node});
        }

        if (node.type === "commands/Command") {
            const name = String(node.properties.name ?? "");
            const previous = commands.get(name);
            if (previous) {
                const message = `Two Command nodes, "${previous.title}" and "${node.title}", are named /${name}. Rename one.`;
                add("error", previous, message);
                add("error", node, message);
            } else commands.set(name, node);
            if (projectInfo.commands?.some(command => command.name === name)) {
                add("warning", node, `/${name} on "${node.title}" is a Command node and also in Project Information > Commands. Remove it from the list.`);
            }
        }
        if (node.type === "config/ConfigValue") {
            const key = String(node.properties.key ?? "");
            if (!key || !projectInfo.config?.some(entry => entry.key === key)) {
                add("error", node, key ? `Pick a key on "${node.title}", or add "${key}" in Project Information > Config.` : `Pick a key on "${node.title}". Add it in Project Information > Config first.`);
            }
        }
    }

    const keys = new Set<string>();
    for (const entry of projectInfo.config || []) {
        const key = entry.key;
        if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(key)) {
            add("error", undefined, `The config key "${key}" isn't valid. Use letters, numbers, underscores, or hyphens between dots in Project Information > Config.`);
        }
        if (keys.has(key)) add("error", undefined, `The config key "${key}" appears twice. Remove one in Project Information > Config.`);
        keys.add(key);
    }
    for (const key of keys) {
        const segments = key.split(".");
        for (let i = 1; i < segments.length; i++) {
            const parent = segments.slice(0, i).join(".");
            if (keys.has(parent)) add("error", undefined, `The config key "${key}" clashes with "${parent}". Fix it in Project Information > Config.`);
        }
    }
    return problems;
}

export function validateProject(root: LGraph, projectInfo: ValidationProjectInfo): Problem[] {
    const problems = subgraphProblems(root);
    let flat;
    try {
        flat = flattenGraph(root);
    } catch (error) {
        if (!(error instanceof SourceError)) throw error;
        return [...problems, {severity: "error", nodeId: error.path?.[0] ?? error.nodeId, path: error.path, message: error.message}];
    }
    return [...problems, ...validateGraph(flat.graph, projectInfo).map(problem => {
        if (problem.nodeId === undefined) return problem;
        const path = pathOf(flat.paths, problem.nodeId);
        return {...problem, nodeId: path[0], path};
    })];
}
