import Colors = require("../colors");
import {shapeAndColorsForSlotType, getNumberSuffix, handleDescDrawBackground} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {sourceProperty, isCharValue, javaCharLiteral} from "../sourceChecks";
import type {NativeNode, NodeModule} from "../../types/nodes";

// String Constant

function StringConstant(this: NativeNode) {
    this.classType = "native";
    this.desc = "A constant String";
    this.iconName = "align-left";
    this.addOutput("", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    this.addProperty("string", "", "string");
}

StringConstant.prototype.color = Colors.STRING_OFF;
StringConstant.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["java.lang.String " + output[0] + " = " + JSON.stringify(this.properties.string)];
};
StringConstant.prototype.onPropertyChanged = function (this: NativeNode, k: string, p: unknown): void {
    this.outputs[0].label = this.properties.string;
    this.size = this.computeSize();
};
StringConstant.prototype.onDrawTitleBox = handleDrawTitleBox;
StringConstant.prototype.onConfigure = StringConstant.prototype.onPropertyChanged;

// Number Constant

function NumberConstant(this: NativeNode) {
    this.classType = "native";
    this.desc = "A constant Number";
    this.iconName = "sort-numeric-down";//TODO: find a better icon
    this.addOutput("", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addProperty("number", 0, "number");
}

NumberConstant.prototype.color = Colors.NUMBER_OFF;
NumberConstant.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    const type = sourceProperty(this, "type");
    return [type + " " + output[0] + " = " + sourceProperty(this, "number") + getNumberSuffix(type)];
};
NumberConstant.prototype.onPropertyChanged = function (this: NativeNode, k: string, p: unknown): void {
    this.outputs[0].label = this.properties.type + " " + this.properties.number;
    this.outputs[0].type = this.properties.type!;
    this.size = this.computeSize();
};
NumberConstant.prototype.onDrawTitleBox = handleDrawTitleBox;
NumberConstant.prototype.onConfigure = NumberConstant.prototype.onPropertyChanged;

// Char Constant

function CharConstant(this: NativeNode) {
    this.classType = "native";
    this.desc = "A constant character (char), such as & for color codes";
    this.iconName = "font";
    this.addOutput("", "char", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addProperty("char", "", "string");
}

CharConstant.prototype.color = Colors.NUMBER_OFF;
CharConstant.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["char " + output[0] + " = " + javaCharLiteral(sourceProperty(this, "char"))];
};
CharConstant.prototype.onPropertyChanged = function (this: NativeNode, k: string, p: unknown): void {
    this.outputs[0].label = isCharValue(this.properties.char) ? "char " + javaCharLiteral(this.properties.char) : "char";
    this.size = this.computeSize();
};
CharConstant.prototype.onDrawTitleBox = handleDrawTitleBox;
CharConstant.prototype.onConfigure = CharConstant.prototype.onPropertyChanged;

// Boolean Constant

function BooleanConstant(this: NativeNode) {
    this.classType = "native";
    this.desc = "A constant boolean";
    this.iconName = "toggle-on";
    this.addOutput("", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addProperty("value", false, "boolean");
}

BooleanConstant.prototype.color = Colors.BOOLEAN_OFF;
BooleanConstant.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[0] + " = " + sourceProperty(this, "value")];
};
BooleanConstant.prototype.onPropertyChanged = function (this: NativeNode, k: string, p: unknown): void {
    this.outputs[0].label = "" + this.properties.value;
    this.size = this.computeSize();
};
BooleanConstant.prototype.onDrawTitleBox = handleDrawTitleBox;
BooleanConstant.prototype.onConfigure = BooleanConstant.prototype.onPropertyChanged;

// Null Constant

function Null(this: NativeNode) {
    this.classType = "native";
    this.desc = "Null constant";
    this.addOutput("null", null, shapeAndColorsForSlotType("object"));
}

Null.prototype.color = Colors.OBJECT_OFF;
Null.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["java.lang.Object " + output[0] + " = null"];
};


export = [
    StringConstant,
    NumberConstant,
    CharConstant,
    BooleanConstant,
    Null
] satisfies NodeModule;
