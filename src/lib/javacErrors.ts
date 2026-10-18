import path = require("path");

export interface JavacError { file: string; line: number; message: string; detail: string[]; }

export function parseJavacErrors(output: string): JavacError[] {
    const errors: JavacError[] = [];
    let current: JavacError | undefined;
    for (const line of output.split(/\r?\n/)) {
        const match = /^(.*\.java):(\d+): error: (.*)$/.exec(line);
        if (match) {
            current = {file: match[1], line: Number(match[2]), message: match[3], detail: []};
            errors.push(current);
        } else if (/^(?:Note:|warning:|.*:\d+: warning:|\d+ errors?$|\d+ warnings?$)/.test(line)) {
            current = undefined;
        } else if (current && line.trim()) {
            // javac prints source lines without indentation when the generated source has none.
            current.detail.push(line);
        }
    }
    return errors;
}

export function nodeForLine(source: string, line: number): number | undefined {
    const lines = source.split(/\r?\n/);
    if (line < 1 || line > lines.length) return undefined;
    const fallback = /\bnode_(\d+)\b|\bnode_(\d+)_/.exec(lines[line - 1]);
    let closedBlocks = 0;
    for (let i = line - 1; i >= 0; i--) {
        const text = lines[i];
        const header = /^\s*(?:public|private|protected)\s+(?:[\w<>.\[\],?]+\s+)*([\w$]+)\s*\([^;]*\)\s*(?:throws [^{]+)?\s*\{/.exec(text);
        if (header) {
            if (closedBlocks > 0) break;
            const node = /^(?:node_(\d+)_(?:exec|in_\d+)|on(\d+))$/.exec(header[1]);
            if (node) return Number(node[1] || node[2]);
            break;
        }
        closedBlocks += (text.match(/}/g) || []).length - (text.match(/{/g) || []).length;
        const debug = /pb_debug_exec=(\d+)/.exec(text);
        if (debug && closedBlocks <= 0) return Number(debug[1]);
    }
    return fallback ? Number(fallback[1] || fallback[2]) : undefined;
}

function shortTypes(text: string): string {
    return text.replace(/(?:[a-z_$][\w$]*\.)+([A-Z_$][\w$]*)/g, "$1");
}

export function explainJavacError(error: JavacError): string {
    const message = error.message;
    let match = /^incompatible types: (.+) cannot be converted to (.+)$/.exec(message);
    if (match) return `You plugged a ${shortTypes(match[1])} into a slot that needs a ${shortTypes(match[2])}.`;
    if (message === "cannot find symbol") {
        const symbol = error.detail.map(line => /^\s*symbol:\s*(.*)$/.exec(line)?.[1]).find(Boolean);
        if (symbol && /^method node_\d+_exec\(\)/.test(symbol)) return "A node isn't generated because it's missing a connection, usually its REF input.";
        return `The code uses ${shortTypes(symbol || "a name")}, which doesn't exist. A node is probably missing a connection.`;
    }
    match = /^variable (\S+) is already defined/.exec(message);
    if (match) return `Two variables are named ${match[1]}. Rename one, or give them the same type.`;
    match = /^unreported exception (.+); must be caught or declared to be thrown$/.exec(message);
    if (match) return `This method can fail with ${shortTypes(match[1])}, and PluginBlueprint can't catch exceptions yet. Use a method that doesn't throw it.`;
    match = /^reference to (\S+) is ambiguous/.exec(message);
    if (match) return `Several versions of ${match[1]} fit these inputs. Connect inputs with more specific types.`;
    if (["<identifier> expected", "';' expected", "illegal start of expression"].includes(message)) return "A name or value on this node isn't valid Java. Check its names and text.";
    match = /^method (\S+) in class .* cannot be applied to given types/.exec(message);
    if (match) return `${match[1]} got the wrong number or kind of inputs.`;
    return message;
}

export function formatJavacErrors(errors: JavacError[], sources: Map<string, string>): string {
    return errors.map(error => {
        const file = path.win32.basename(error.file);
        const source = sources.get(error.file);
        const node = file === "GeneratedPlugin.java" && source !== undefined ? nodeForLine(source, error.line) : undefined;
        const location = file === "GeneratedPlugin.java" ? `Line ${error.line}${node !== undefined ? ` (node_${node})` : ""}` : `${file} line ${error.line}`;
        return `${location}: ${explainJavacError(error)}\n    javac: ${error.message}`;
    }).join("\n\n");
}
