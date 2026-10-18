import {execFile} from "child_process";
import os = require("os");

export function defaultAuthor(): Promise<string> {
    return new Promise(resolve => {
        execFile("git", ["config", "user.name"], (err, stdout) => {
            if (!err && stdout.trim()) return resolve(stdout.trim());
            try {
                resolve(os.userInfo().username);
            } catch {
                resolve("");
            }
        });
    });
}

export function defaultPackage(author: string, pluginName: string): string {
    let reservedWords = new Set([
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue",
        "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if",
        "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private",
        "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
        "throw", "throws", "transient", "try", "void", "volatile", "while", "true", "false", "null", "_"
    ]);
    let segment = (value: string, fallback: string) => {
        let result = value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
        if (!result) return fallback;
        if (reservedWords.has(result)) result += fallback;
        return /^\d/.test(result) ? "x" + result : result;
    };
    return "me." + segment(author, "author") + "." + segment(pluginName, "plugin");
}
