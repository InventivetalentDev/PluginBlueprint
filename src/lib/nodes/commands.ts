import {shapeAndColorsForSlotType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import type {CommandArgument, NativeNode, NodeModule} from "../../types/nodes";
import type {ContextMenuItem, LGraphCanvas} from "../../../assets/lib/litegraph/litegraph";

const argumentTypes: {type: CommandArgument["type"]; label: string; java: string}[] = [
    {type: "word", label: "Word", java: "java.lang.String"},
    {type: "text", label: "Rest of text", java: "java.lang.String"},
    {type: "int", label: "Whole number", java: "int"},
    {type: "double", label: "Number", java: "double"},
    {type: "boolean", label: "True/false", java: "boolean"},
    {type: "player", label: "Player", java: "org.bukkit.entity.Player"}
];

function cleanName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function cleanAliases(value: string): string[] {
    return value.split(",").map(cleanName).filter(Boolean);
}

function Command(this: NativeNode) {
    this.classType = "native";
    this.iconName = "terminal";
    for (let [name, type] of [
        ["EXEC", "@EXEC"], ["sender", "org.bukkit.command.CommandSender"],
        ["player", "org.bukkit.entity.Player"], ["args", "java.lang.String[]"]
    ]) this.addOutput(name, type, shapeAndColorsForSlotType(type));
    this.addProperty("name", "mycommand", "string");
    this.addProperty("description", "", "string");
    this.addProperty("aliases", "", "string");
    this.addProperty("permission", "", "string");
    this.addProperty("permissionMessage", "<red>You don't have permission to use this command.", "string");
    this.addProperty("playersOnly", false, "boolean");
    this.properties.arguments = [];
    this.title = "/mycommand";
}

Command.title = "Command";
Command.prototype.onPropertyChanged = function (this: NativeNode, name: string): void {
    if (name === "name") this.properties.name = cleanName(this.properties.name || "") || "mycommand";
    if (name === "aliases") this.properties.aliases = cleanAliases(this.properties.aliases || "").join(",");
    if (name === "permission") this.properties.permission = (this.properties.permission || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
    this.title = "/" + this.properties.name;
};
Command.prototype.getMenuOptions = function (this: NativeNode, canvas: LGraphCanvas): ContextMenuItem[] {
    return [
        {content: "Properties", has_submenu: true, submenu: {options: Object.keys(this.properties).filter(name => name !== "arguments").map(name => ({
            content: name,
            callback: (value, options, event) => canvas.showEditPropertyValue(this, name, {position: [event.clientX, event.clientY]})
        }))}},
        {content: "Add argument", has_submenu: true, disabled: this.properties.arguments?.some(arg => arg.type === "text"), submenu: {options: argumentTypes.map(arg => ({
            content: arg.label,
            callback: (value, options, event) => {
                canvas.prompt("Argument name", "", (answer: string) => {
                    if (answer == null || this.properties.arguments?.some(arg => arg.type === "text")) return;
                    let args = this.properties.arguments || [];
                    let name = answer.replace(/[^A-Za-z0-9_-]/g, "") || "arg" + (args.length + 1);
                    this.graph?.beforeChange(this);
                    this.properties.arguments = [...args, {name, type: arg.type}];
                    this.addOutput(name, arg.java, shapeAndColorsForSlotType(arg.java, {removable: true, nameLocked: true}));
                    this.size = this.computeSize();
                    this.graph?.afterChange(this);
                }, event);
            }
        }))}}
    ];
};
Command.prototype.onOutputRemoved = function (this: NativeNode, slot: number): void {
    if (slot >= 4) {
        this.properties.arguments?.splice(slot - 4, 1);
        this.graph?.afterChange(this);
    }
};
Command.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return this.outputs.slice(1).map((slot, i) => slot.type + " " + output[i + 1]);
};
Command.prototype.getOnEnable = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    let name = cleanName(this.properties.name || "") || "mycommand";
    let aliases = cleanAliases(this.properties.aliases || "");
    let permission = (this.properties.permission || "").toLowerCase().replace(/[^a-z0-9._-]/g, "");
    let args = this.properties.arguments || [];
    let usage = JSON.stringify("Usage: /" + name + args.map(arg => " <" + arg.name + (arg.type === "text" ? "..." : "") + ">").join(""));
    let fail = output[1] + ".sendMessage(" + usage + "); return;";
    let code = "registerCommand(" + JSON.stringify(name);
    if (this.properties.description || aliases.length) code += ", " + JSON.stringify(this.properties.description || "");
    if (aliases.length) code += ", java.util.List.of(" + aliases.map(alias => JSON.stringify(alias)).join(", ") + ")";
    code += ", new io.papermc.paper.command.brigadier.BasicCommand() {\n" +
        "@Override\npublic void execute(io.papermc.paper.command.brigadier.CommandSourceStack source, java.lang.String[] args) {\n" +
        output[1] + " = source.getSender();\n" +
        output[2] + " = " + output[1] + " instanceof org.bukkit.entity.Player ? (org.bukkit.entity.Player) " + output[1] + " : null;\n" +
        output[3] + " = args;\n";
    if (permission) code += "if (!" + output[1] + ".hasPermission(" + JSON.stringify(permission) + ")) { " + output[1] + ".sendRichMessage(" + JSON.stringify(this.properties.permissionMessage ?? "<red>You don't have permission to use this command.") + "); return; }\n";
    if (this.properties.playersOnly) code += "if (" + output[2] + " == null) { " + output[1] + ".sendRichMessage(" + JSON.stringify("<red>Only players can use this command.") + "); return; }\n";
    if (args.length) code += "if (args.length < " + args.length + ") { " + fail + " }\n";
    for (let i = 0; i < args.length; i++) {
        let field = output[i + 4];
        let value = "args[" + i + "]";
        switch (args[i].type) {
            case "word": code += field + " = " + value + ";\n"; break;
            case "text": code += field + " = java.lang.String.join(" + JSON.stringify(" ") + ", java.util.Arrays.copyOfRange(args, " + i + ", args.length));\n"; break;
            case "int":
            case "double":
                code += "try { " + field + " = java.lang." + (args[i].type === "int" ? "Integer.parseInt" : "Double.parseDouble") + "(" + value + "); } catch (java.lang.NumberFormatException e) { " + fail + " }\n";
                break;
            case "boolean":
                code += "if (!" + JSON.stringify("true") + ".equalsIgnoreCase(" + value + ") && !" + JSON.stringify("false") + ".equalsIgnoreCase(" + value + ")) { " + fail + " }\n" +
                    field + " = " + JSON.stringify("true") + ".equalsIgnoreCase(" + value + ");\n";
                break;
            case "player":
                code += field + " = org.bukkit.Bukkit.getPlayerExact(" + value + ");\n" +
                    "if (" + field + " == null) { " + output[1] + ".sendMessage(" + JSON.stringify("Player not found: ") + " + " + value + "); return; }\n";
                break;
        }
    }
    code += "node_" + this.id + "_exec();\n}\n";
    if (args.some(arg => arg.type === "player" || arg.type === "boolean")) {
        code += "@Override\npublic java.util.Collection<java.lang.String> suggest(io.papermc.paper.command.brigadier.CommandSourceStack source, java.lang.String[] args) {\n" +
            "int index = args.length == 0 ? 0 : args.length - 1;\n" +
            "java.lang.String prefix = args.length == 0 ? " + JSON.stringify("") + " : args[index].toLowerCase();\n";
        for (let i = 0; i < args.length; i++) {
            if (args[i].type === "player") code += "if (index == " + i + ") return org.bukkit.Bukkit.getOnlinePlayers().stream().map(org.bukkit.entity.Player::getName).filter(name -> name.toLowerCase().startsWith(prefix)).toList();\n";
            if (args[i].type === "boolean") code += "if (index == " + i + ") return java.util.List.of(" + JSON.stringify("true") + ", " + JSON.stringify("false") + ").stream().filter(value -> value.startsWith(prefix)).toList();\n";
        }
        code += "return java.util.List.of();\n}\n";
    }
    return code + "});";
};
Command.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
Command.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [Command] satisfies NodeModule;
