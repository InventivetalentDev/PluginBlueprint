import type {SerializedLGraphNode, SerializedLGraphGroup} from "../../assets/lib/litegraph/litegraph";

export interface ProjectInfo {
    name: string;
    creationTime: number;
    description: string;
    author: string;
    package: string;
    version: string;
    type: string;
    minecraftVersion: string;
    lastSave: number;
    lastCompile: number;
    editorVersion: string;
    buildNumber: number;
    debug?: boolean;
    softdepend?: string[];
    depend?: string[];
    loadbefore?: string[];
    load?: "STARTUP" | "POSTWORLD";
    website?: string;
    authors?: string[];
    prefix?: string;
    libraries?: string[];
    permissions?: ProjectPermission[];
    commands?: ProjectCommand[];
    gitUser?: string;
    isNewProject?: boolean;
}

export interface ProjectPermission {
    name: string;
    description?: string;
    default?: "true" | "false" | "op" | "not op";
}

export interface ProjectCommand {
    name: string;
    description: string;
    usage: string;
    aliases?: string | string[];
}

export interface Snippet {
    nodes: SerializedLGraphNode[];
    links: {id: number; oId: number; oSlot: number; tId: number; tSlot: number; type: string | number}[];
    groups: SerializedLGraphGroup[];
    zoom: number;
}
