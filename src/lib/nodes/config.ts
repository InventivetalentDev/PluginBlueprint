import {shapeAndColorsForSlotType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import type {NativeNode, NodeModule} from "../../types/nodes";
import type {ConfigEntry} from "../../types/project";
import type {IWidget} from "../../../assets/lib/litegraph/litegraph";

const configTypes = {
    string: {java: "java.lang.String", getter: "getString"},
    int: {java: "int", getter: "getInt"},
    double: {java: "double", getter: "getDouble"},
    boolean: {java: "boolean", getter: "getBoolean"},
    list: {java: "java.util.List", getter: "getStringList"}
};

function configType(node: NativeNode): ConfigEntry["type"] {
    let type = node.properties.type;
    return type === "int" || type === "double" || type === "boolean" || type === "list" ? type : "string";
}

function ConfigValue(this: NativeNode) {
    this.classType = "native";
    this.iconName = "cog";
    this.addProperty("key", "", "string");
    this.addProperty("type", "string", "string");
    this.addOutput("", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    this.addWidget<IWidget<string, {values: () => string[]}>>("combo", "key", "", value => {
        this.graph?.beforeChange(this);
        let previous = this.properties.key;
        this.properties.key = value;
        let entry = window.projectInfo?.config?.find(entry => entry.key === value);
        if (entry) this.properties.type = entry.type;
        if (this.outputs[0].type !== configTypes[configType(this)].java) this.disconnectOutput(0);
        this.onPropertyChanged?.("key", value, previous);
        this.graph?.afterChange(this);
    }, {values: () => window.projectInfo?.config?.map(entry => entry.key) || []});
}

ConfigValue.title = "Config value";
ConfigValue.prototype.onPropertyChanged = function (this: NativeNode): void {
    this.outputs[0].label = this.properties.key;
    if (this.widgets?.[0]) this.widgets[0].value = this.properties.key || "";
    let type = configTypes[configType(this)].java;
    Object.assign(this.outputs[0], shapeAndColorsForSlotType(type), {type});
    this.size = this.computeSize();
};
ConfigValue.prototype.getOutputExpression = function (this: NativeNode): string {
    return "getConfig()." + configTypes[configType(this)].getter + "(" + JSON.stringify(this.properties.key || "") + ")";
};
ConfigValue.prototype.onDrawTitleBox = handleDrawTitleBox;

function ReloadConfig(this: NativeNode) {
    this.classType = "native";
    this.iconName = "sync";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
}

ReloadConfig.title = "Reload config";
ReloadConfig.prototype.getMethodBody = function (): string {
    return "reloadConfig();";
};
ReloadConfig.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
ReloadConfig.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [ConfigValue, ReloadConfig] satisfies NodeModule;
