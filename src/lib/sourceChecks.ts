import {parseTypeSwitchEnum} from "./util";

interface SourceNode {
    id?: number;
    type?: string | null;
    title: string;
    className?: string;
    properties: Record<string, unknown>;
}

interface SourceClasses {
    getClass(name?: string): {enumConstants?: string[]} | null | undefined;
    getField(className?: string, name?: string): unknown;
}

export class SourceError extends Error {
    constructor(message: string, readonly nodeId?: number) {
        super(message);
    }
}

export function isGraphId(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function graphIdProblems(graph: {_nodes: {id?: unknown; title: string}[]; links: Record<string, unknown>}): {nodeId?: number; message: string}[] {
    const problems: {nodeId?: number; message: string}[] = [];
    for (const node of graph._nodes) {
        if (!isGraphId(node.id)) {
            problems.push({message: `"${node.title}" has an invalid id. The project or snippet file is damaged; delete the node and add it again.`});
        }
    }
    for (const value of Object.values(graph.links)) {
        if (value == null) continue;
        const link = value as Record<string, unknown>;
        if (["id", "origin_id", "origin_slot", "target_id", "target_slot"].every(key => isGraphId(link[key]))) continue;
        const nodeId = isGraphId(link.target_id) ? link.target_id : isGraphId(link.origin_id) ? link.origin_id : undefined;
        problems.push({...(nodeId !== undefined ? {nodeId} : {}), message: "A connection has an invalid id or slot. The project or snippet file is damaged; delete the connection and connect it again."});
    }
    return problems;
}

const keywords = new Set(("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _").split(" "));
export const numberTypes = ["byte", "char", "short", "int", "long", "float", "double"];

export function isJavaIdentifier(value: unknown): value is string {
    return typeof value === "string" && /^[\p{L}\p{Nl}\p{Sc}\p{Pc}][\p{L}\p{Nl}\p{Sc}\p{Pc}\p{Nd}\p{Mc}\p{Mn}\p{Cf}]*$/u.test(value) && !keywords.has(value);
}

export function isJavaTypeName(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const base = value.replace(/(?:\[\])+$/, "");
    return numberTypes.includes(base) || base === "boolean" || base.split(".").every(isJavaIdentifier);
}

export function isNumberValue(value: unknown, type: string): boolean {
    if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d+(\.\d+)?$/.test(value))) return false;
    const number = Number(value);
    return Number.isFinite(number) && (!["byte", "char", "short", "int", "long"].includes(type) || Number.isInteger(number));
}

export function isBooleanValue(value: unknown): boolean {
    return value === true || value === false || value === "true" || value === "false";
}

const rules: {
    node: (node: SourceNode) => boolean;
    property: string;
    check: (value: unknown, node: SourceNode, classes?: SourceClasses) => boolean;
    message: (title: string, value: unknown, node: SourceNode) => string;
}[] = [
    ...["codeInputs", "codeOutputs"].map(property => ({
        node: (node: SourceNode) => node.type === "code/JavaCode", property,
        check: (value: unknown, node: SourceNode) => {
            if (!Array.isArray(value)) return false;
            const inputs = property === "codeOutputs" && Array.isArray(node.properties.codeInputs) ? node.properties.codeInputs : [];
            return value.every((slot, index) => slot && isJavaIdentifier(slot.name) && isJavaTypeName(slot.type) &&
                !value.slice(0, index).some(previous => previous?.name === slot.name) && !inputs.some(input => input?.name === slot.name));
        },
        message: (title: string, value: unknown, node: SourceNode) => {
            const direction = property === "codeInputs" ? "Input" : "Output";
            if (!Array.isArray(value)) return `The ${direction.toLowerCase()} declarations on "${title}" must be a list of names and Java types.`;
            const inputs = property === "codeOutputs" && Array.isArray(node.properties.codeInputs) ? node.properties.codeInputs : [];
            const slot = value.find((slot, index) => !slot || !isJavaIdentifier(slot.name) || !isJavaTypeName(slot.type) ||
                value.slice(0, index).some(previous => previous?.name === slot.name) || inputs.some(input => input?.name === slot.name));
            const label = `${direction} "${typeof slot?.name === "string" ? slot.name : ""}" on "${title}"`;
            if (!isJavaIdentifier(slot?.name)) return `${label} isn't a Java name. Use letters and numbers without spaces.`;
            if (!isJavaTypeName(slot.type)) return `${label} has an invalid Java type. Use a type such as int or java.lang.String.`;
            return `${label} uses a name that's already declared. Give each input and output a different name.`;
        }
    })),
    {
        node: node => node.type === "code/JavaCode", property: "code", check: value => typeof value === "string",
        message: title => `The code on "${title}" must be text.`
    },
    {
        node: node => node.type === "constants/NumberConstant", property: "type",
        check: value => typeof value === "string" && numberTypes.includes(value),
        message: title => `The number type on "${title}" isn't valid. Choose byte, char, short, int, long, float or double.`
    },
    {
        node: node => node.type === "constants/NumberConstant", property: "number",
        check: (value, node) => isNumberValue(value, typeof node.properties.type === "string" ? node.properties.type : ""),
        message: title => `The number on "${title}" isn't valid for its type. Enter a finite number, and use a whole number for byte, char, short, int or long.`
    },
    {
        node: node => node.type === "constants/BooleanConstant", property: "value", check: isBooleanValue,
        message: title => `The boolean value on "${title}" isn't valid. Choose true or false.`
    },
    {
        node: node => node.type === "variables/Set" || node.type === "variables/Get", property: "name", check: isJavaIdentifier,
        message: (title, value) => `The variable name "${typeof value === "string" ? value : ""}" on "${title}" isn't a Java identifier. Use a name such as count, without spaces or Java keywords.`
    },
    {
        node: node => node.type === "variables/Set" || node.type === "variables/Get", property: "type",
        check: value => (value == null || typeof value === "string") && isJavaTypeName(parseTypeSwitchEnum(value)),
        message: title => `The variable type on "${title}" isn't valid. Use a Java type such as int or java.lang.String.`
    },
    {
        node: node => node.type === "native/Cast", property: "castTo", check: isJavaTypeName,
        message: title => `The cast type on "${title}" isn't valid. Use a Java type such as org.bukkit.entity.Player.`
    },
    {
        node: node => node.type === "native/InstanceOf", property: "type", check: isJavaTypeName,
        message: title => `The instanceof type on "${title}" isn't valid. Use a Java type such as org.bukkit.entity.Player.`
    },
    {
        node: node => node.type?.startsWith("arithmetic/") === true, property: "type",
        check: value => typeof value === "string" && numberTypes.includes(value),
        message: title => `The arithmetic type on "${title}" isn't valid. Choose byte, char, short, int, long, float or double.`
    },
    {
        node: node => node.type === "arrays/MakeArray", property: "type", check: isJavaTypeName,
        message: title => `The array type on "${title}" isn't valid. Use a Java type such as int or java.lang.String.`
    },
    {
        node: node => node.type === "events/CancelEvent", property: "cancel", check: isBooleanValue,
        message: title => `The cancellation value on "${title}" isn't valid. Choose true or false.`
    },
    {
        node: node => Object.hasOwn(node.properties, "priority"), property: "priority",
        check: value => typeof value === "string" && ["LOWEST", "LOW", "NORMAL", "HIGH", "HIGHEST", "MONITOR"].includes(value),
        message: title => `The event priority on "${title}" isn't valid. Choose LOWEST, LOW, NORMAL, HIGH, HIGHEST or MONITOR.`
    },
    {
        node: node => Object.hasOwn(node.properties, "ignoreCancelled"), property: "ignoreCancelled",
        check: value => value === undefined || typeof value === "boolean",
        message: title => `The ignoreCancelled value on "${title}" isn't valid. Choose true or false.`
    },
    {
        node: node => Object.hasOwn(node.properties, "en"), property: "en",
        check: (value, node, classes) => typeof value === "string" && classes?.getClass(node.className)?.enumConstants?.includes(value) === true,
        message: title => `The enum value on "${title}" isn't valid. Choose a value from its list.`
    },
    {
        node: node => Object.hasOwn(node.properties, "field"), property: "field",
        check: (value, node, classes) => {
            const field = typeof value === "string" && classes?.getField(node.className, value);
            return !!field && typeof field === "object" && "isStatic" in field && field.isStatic === true;
        },
        message: title => `The static field on "${title}" isn't valid. Choose a field from its list.`
    }
];

export function propertyProblems(node: SourceNode, classes?: SourceClasses): {property: string; message: string}[] {
    return rules.filter(rule => rule.node(node) && !rule.check(node.properties[rule.property], node, classes))
        .map(rule => ({property: rule.property, message: rule.message(node.title, node.properties[rule.property], node)}));
}

export function sourceProperty(node: SourceNode, property: string, classes?: SourceClasses): string {
    const rule = rules.find(rule => rule.property === property && rule.node(node));
    const value = node.properties[property];
    if (!rule || !rule.check(value, node, classes)) {
        throw new SourceError(rule ? rule.message(node.title, value, node) : `The "${property}" value on "${node.title}" has no source rule.`, node.id);
    }
    return String(value);
}

export function sourceType(node: SourceNode, type: unknown): string {
    if (!isJavaTypeName(type)) throw new SourceError(`A slot type on "${node.title}" isn't valid. Use a Java type such as int or java.lang.String.`, node.id);
    return type;
}

export const NODE_KEYS = ["id", "type", "pos", "size", "flags", "order", "mode", "inputs", "outputs", "title", "properties", "color", "bgcolor", "boxcolor", "shape", "widgets_values"];

export function pickNodeKeys<T extends object>(node: T): T {
    return Object.fromEntries(Object.entries(node).filter(([key]) => NODE_KEYS.includes(key))) as T;
}
