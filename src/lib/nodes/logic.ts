import Colors = require("../colors");
import {shapeAndColorsForSlotType, isPrimitiveType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import type {NativeNode, NodeModule} from "../../types/nodes";

// NotGate

function NotGate(this: NativeNode) {
    this.classType = "native";
    this.iconName = "dungeon";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("IN", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

NotGate.title = "NotGate";
NotGate.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[1]];
};
NotGate.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = !" + input[1] + ";\n";
};
NotGate.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
NotGate.prototype.onDrawTitleBox = handleDrawTitleBox;


// AndGate

function AndGate(this: NativeNode) {
    this.classType = "native";
    this.iconName = "dungeon";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("A", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addInput("B", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

AndGate.title = "AndGate";
AndGate.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[1]];
};
AndGate.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + " && " + input[2] + ";\n";
};
AndGate.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
AndGate.prototype.onDrawTitleBox = handleDrawTitleBox;


// OrGate

function OrGate(this: NativeNode) {
    this.classType = "native";
    this.iconName = "dungeon";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("A", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addInput("B", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

OrGate.title = "OrGate";
OrGate.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[1]];
};
OrGate.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + " || " + input[2] + ";\n";
};
OrGate.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
OrGate.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [
    NotGate,
    AndGate,
    OrGate
] satisfies NodeModule;