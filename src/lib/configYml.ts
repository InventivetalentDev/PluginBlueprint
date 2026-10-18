import type {ConfigEntry} from "../types/project";

interface ConfigMap {
    key: string;
    entry?: ConfigEntry;
    children: Map<string, ConfigMap>;
}

export function makeConfigYml(entries: ConfigEntry[]): string {
    let root: ConfigMap = {key: "", children: new Map()};
    for (let entry of entries) {
        let parts = entry.key.split(".");
        if (parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
            throw new Error('Config key "' + entry.key + '" can only use letters, digits, - and _ between dots.');
        }
        let node = root;
        for (let part of parts) {
            if (node.entry) throw new Error('Config key "' + entry.key + '" clashes with "' + node.entry.key + '".');
            let child = node.children.get(part);
            if (!child) {
                child = {key: entry.key, children: new Map()};
                node.children.set(part, child);
            }
            node = child;
        }
        if (node.entry || node.children.size) throw new Error('Config key "' + entry.key + '" clashes with "' + node.key + '".');
        node.entry = entry;
    }
    function emit(node: ConfigMap, depth: number): string {
        let yml = "";
        for (let [key, child] of node.children) {
            let prefix = "  ".repeat(depth) + JSON.stringify(key) + ":";
            let entry = child.entry;
            if (!entry) {
                yml += prefix + "\n" + emit(child, depth + 1);
                continue;
            }
            let value = entry.default;
            switch (entry.type) {
                case "string": value = JSON.stringify(value); break;
                case "int": value = /^-?\d+$/.test(value) ? value : "0"; break;
                case "double": value = value.trim() && Number.isFinite(Number(value)) ? value : "0.0"; break;
                case "boolean": value = value.toLowerCase() === "true" ? "true" : "false"; break;
                case "list": {
                    let items = value.split(",").map(item => item.trim()).filter(Boolean);
                    value = items.length ? "\n" + items.map(item => "  ".repeat(depth + 1) + "- " + JSON.stringify(item)).join("\n") : "[]";
                    break;
                }
            }
            yml += prefix + (value.startsWith("\n") ? "" : " ") + value + "\n";
        }
        return yml;
    }
    return emit(root, 0);
}
