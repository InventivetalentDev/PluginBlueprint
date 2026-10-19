import Colors = require("../colors");
import {shapeAndColorsForSlotType, typeSwitchEnum, parseTypeSwitchEnum, handleDescDrawBackground} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {sourceProperty} from "../sourceChecks";
import type {NativeNode, NodeModule} from "../../types/nodes";

function Set(this: NativeNode) {
    this.classType = "native";
    this.desc = "Set the value of a variable";
    this.iconName = "sign-in-alt";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
    this.addProperty("type", "string", "enum", {values: typeSwitchEnum})
}

Set.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    this.inputs[1].label = this.properties.name;
    this.inputs[1].type = parseTypeSwitchEnum(this.properties.type);
    handleDescDrawBackground.call(this, ctx);
};
Set.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    sourceProperty(this, "type");
    return [parseTypeSwitchEnum(this.properties.type) + " " + sourceProperty(this, "name")];
};
Set.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return sourceProperty(this, "name") + " = " + input[1] + ";";
};
Set.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
Set.prototype.onConfigure = function (this: NativeNode): void {
    if (this.findOutputSlot("EXEC") < 0) {
        this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    }
    this.size = this.computeSize();
};
Set.prototype.onDrawTitleBox = handleDrawTitleBox;


function Get(this: NativeNode) {
    this.classType = "native";
    this.desc = "Get the value of a variable";
    this.iconName = "sign-out-alt";
    this.addOutput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
    this.addProperty("type", "string", "enum", {values: typeSwitchEnum})
}

Get.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    this.outputs[0].label = this.properties.name;
    this.outputs[0].type = parseTypeSwitchEnum(this.properties.type);
    handleDescDrawBackground.call(this, ctx);
};
Get.prototype.getFields = Set.prototype.getFields;
Get.prototype.getOutputExpression = function (this: NativeNode, slot: number): string {
    return sourceProperty(this, "name");
};
Get.prototype.onDrawTitleBox = handleDrawTitleBox;


export = [
    Set,
    Get
] satisfies NodeModule;
