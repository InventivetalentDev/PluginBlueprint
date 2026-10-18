import type {ProjectInfo} from "../types/project";

export function makePluginYml(project: ProjectInfo, generatorVersion: string): string {
    let yml = "name: " + JSON.stringify(project.name) +
        "\ndescription: " + JSON.stringify(project.description) +
        "\nversion: " + JSON.stringify(project.version) +
        "\nmain: " + JSON.stringify(project.package + ".GeneratedPlugin") +
        "\nauthor: " + JSON.stringify(project.author) +
        "\nsoftdepend: [" + (project.softdepend || []).map(value => JSON.stringify(value)).join(",") + "]";
    for (let key of ["depend", "loadbefore", "load", "website", "authors", "prefix", "libraries"] as const) {
        let value = project[key];
        if (value && value.length) {
            yml += "\n" + key + ": " + (Array.isArray(value) ? "[" + value.map(item => JSON.stringify(item)).join(",") + "]" : JSON.stringify(value));
        }
    }
    if (project.permissions?.length) {
        yml += "\npermissions:";
        for (let permission of project.permissions) {
            yml += "\n  " + JSON.stringify(permission.name) + ":";
            if (!permission.description && !permission.default) yml += " {}";
            if (permission.description) yml += "\n    description: " + JSON.stringify(permission.description);
            if (permission.default) yml += "\n    default: " + JSON.stringify(permission.default);
        }
    }
    yml += "\ngenerator: " + JSON.stringify("PluginBlueprint " + generatorVersion) +
        "\napi-version: '" + project.minecraftVersion + "'\n";
    if (project.commands) {
        yml += "commands:\n";
        for (let command of project.commands) {
            yml += "  " + JSON.stringify(command.name) + ":\n";
            yml += "    description: " + JSON.stringify(command.description) + "\n";
            yml += "    usage: " + JSON.stringify(command.usage) + "\n";
            let aliases = typeof command.aliases === "string" ? command.aliases.split(",") : command.aliases || [];
            aliases = aliases.map(alias => alias.trim()).filter(Boolean);
            if (aliases.length) yml += "    aliases: [" + aliases.map(alias => JSON.stringify(alias)).join(",") + "]\n";
        }
    }
    return yml;
}
