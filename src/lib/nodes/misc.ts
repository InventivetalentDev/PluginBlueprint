import Colors = require("../colors");
import {shapeAndColorsForSlotType, isPrimitiveType, handleDescDrawBackground} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import type {NativeNode, NodeModule} from "../../types/nodes";
import type {ContextMenuItem, INodeInputSlot, INodeOutputSlot} from "../../../assets/lib/litegraph/litegraph";

type AddNullableInput = (name: string, type: string | -1 | null, options?: Partial<INodeInputSlot>) => INodeInputSlot;
type AddNullableOutput = (name: string, type: string | -1 | null, options?: Partial<INodeOutputSlot>) => INodeOutputSlot;


// Cast

function Cast(this: NativeNode) {
    this.classType = "native";
    this.desc = "Cast an object to another";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    (this.addInput as AddNullableInput)("", null);
    (this.addOutput as AddNullableOutput)("", null);
    this.addProperty("castTo", "java.lang.Object", "string");
}

Cast.title = "Cast";
Cast.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    this.outputs[1].label = "(" + this.properties.castTo + ")";
    handleDescDrawBackground.call(this, ctx);
};
Cast.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return [this.properties.castTo + " " + output[1]];
};
Cast.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = (" + this.properties.castTo + ") " + input[1] + ";";
};
Cast.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};


// InstanceOf

function InstanceOf(this: NativeNode) {
    this.classType = "native";
    this.desc = "Check if an object is an instance of a class";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    (this.addInput as AddNullableInput)("", null, shapeAndColorsForSlotType("object"));

    this.addOutput("instanceof java.lang.Object", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addProperty("type", "java.lang.Object", "string");
}

InstanceOf.title = "InstanceOf";
InstanceOf.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    this.outputs[1].label = "instanceof " + this.properties.type;
    handleDescDrawBackground.call(this, ctx);
};
InstanceOf.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[1]];
};
InstanceOf.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + " instanceof " + this.properties.type + ";";
};
InstanceOf.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};

// String formatting

function StringFormat(this: NativeNode) {
    this.classType = "native";
    this.desc = "Format a string containing placeholders (%s) with variables";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Format", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    (this.addInput as AddNullableInput)("Variable", null);
    this.addOutput("Formatted", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));

    this.optional_inputs = [["Variable", null, {}]];
}

StringFormat.title = "StringFormat";
StringFormat.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["java.lang.String " + output[1]];// Formatted
};
StringFormat.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    let variableInputs = input.slice(2).filter(value => value !== null);
    return output[1] + " = java.lang.String.format(" + input[1] + (variableInputs.length ? ", " + variableInputs.join(",") : "") + ");";
};
StringFormat.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
StringFormat.prototype.getMenuOptions = function (this: NativeNode): ContextMenuItem[] {
    return [
        {content: "Inputs", has_submenu: true, disabled: false, callback: LGraphCanvas.showMenuNodeOptionalInputs}
    ];
};


// Console Log

function ConsoleLog(this: NativeNode) {
    this.classType = "native";
    this.desc = "Log something to the console";
    this.iconName = "print";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    (this.addInput as AddNullableInput)("", null);
}

ConsoleLog.title = "ConsoleLog";
ConsoleLog.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return [];
};
ConsoleLog.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return "getLogger().info(java.lang.String.valueOf(" + input[1] + "));";
};
ConsoleLog.prototype.onDrawTitleBox = handleDrawTitleBox;


export = [
    Cast,
    InstanceOf,

    StringFormat,

    ConsoleLog
] satisfies NodeModule;