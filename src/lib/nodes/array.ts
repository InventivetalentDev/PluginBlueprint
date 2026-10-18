import Colors = require("../colors");
import {shapeAndColorsForSlotType} from "../util";
import type {NativeNode, NodeModule} from "../../types/nodes";
import type {INodeInputSlot, INodeOutputSlot} from "../../../assets/lib/litegraph/litegraph";

type AddNullableInput = (name: string, type: string | -1 | null, options?: Partial<INodeInputSlot>) => INodeInputSlot;
type AddNullableOutput = (name: string, type: string | -1 | null, options?: Partial<INodeOutputSlot>) => INodeOutputSlot;


function MakeArray(this: NativeNode) {
    this.classType = "native";
    this.desc = "Make an array from a set of inputs";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Element", "java.lang.Object");
    this.addOutput("Array", "java.lang.Object[]", shapeAndColorsForSlotType("java.lang.Object"));

    this.addProperty("type", "java.lang.Object", "string");

    this.optional_inputs = [["Element", null, {removable: true}]];
}

MakeArray.title = "MakeArray";
MakeArray.prototype.onPropertyChanged = function (this: NativeNode, p: string, v: unknown): void {
    if (p === "type") {
        let shapeAndColor = shapeAndColorsForSlotType(this.properties.type!);

        this.outputs[1].type = this.properties.type + "[]";
        this.outputs[1].shape = shapeAndColor.shape;
        this.outputs[1].color_on = shapeAndColor.color_on;
        this.outputs[1].color_off = shapeAndColor.color_off;
        for (let i = 0; i < this.inputs.length; i++) {
            if (i >= 1) {
                this.inputs[i].type = this.properties.type!;
                this.inputs[i].shape = shapeAndColor.shape;
                this.inputs[i].color_on = shapeAndColor.color_on;
                this.inputs[i].color_off = shapeAndColor.color_off;
            }
        }
    }
};
MakeArray.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return [this.properties.type + "[] " + output[1]];
};
MakeArray.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    let variableInputs = input.slice(1);
    return output[1] + " = new " + this.properties.type + "[] {" + variableInputs.join(",") + "};";
};
MakeArray.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};


function SetIndex(this: NativeNode) {
    this.classType = "native";
    this.desc = "Set an array item at a specific index";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    (this.addInput as AddNullableInput)("Array", null);
    this.addInput("index", "int", shapeAndColorsForSlotType("int"));
    (this.addInput as AddNullableInput)("Value", null);
}

SetIndex.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return input[1] + "[" + input[2] + "] = " + input[3] + ";";
};
SetIndex.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};


function GetIndex(this: NativeNode) {
    this.classType = "native";
    this.desc = "Get an item from an array from a specific index";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    (this.addInput as AddNullableInput)("Array", null);
    this.addInput("index", "int", shapeAndColorsForSlotType("int"));
    (this.addOutput as AddNullableOutput)("Value", null);
}

GetIndex.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["java.lang.Object " + output[1]];
};

GetIndex.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + "[" + input[2] + "];";
};
GetIndex.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};


function Length(this: NativeNode) {
    this.classType = "native";
    this.desc = "Get the length of an array";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    (this.addInput as AddNullableInput)("Array", null);
    this.addOutput("length", "int", shapeAndColorsForSlotType("int"));
}

Length.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["int " + output[1]];
};

Length.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + ".length;";
};
Length.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};


export = [
    MakeArray,
    SetIndex,
    GetIndex,
    Length
] satisfies NodeModule;