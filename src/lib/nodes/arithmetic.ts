import Colors = require("../colors");
import {shapeAndColorsForSlotType, isPrimitiveType, handleDescDrawBackground} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {sourceProperty} from "../sourceChecks";
import type {NativeNode, NodeModule, NodeFunction} from "../../types/nodes";

const ArithmeticOperator: NodeFunction = function (this: NativeNode) {
    this.classType = "native";
    this.operation = "?";
};

ArithmeticOperator.prototype.init = function (this: NativeNode): void {
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    this.addInput("A", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addInput("B", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addOutput("", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
};

ArithmeticOperator.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    this.outputs[1].type = this.properties.type!;
    this.inputs[1].type = this.properties.type!;
    this.inputs[2].type = this.properties.type!;

    if (this.flags.collapsed)
        return;

    ctx.font = "40px Arial";
    ctx.fillStyle = "#CCC";
    ctx.textAlign = "center";
    ctx.fillText(this.operation!, this.size[0] * 0.5, this.size[1] * 0.5 + 10);
    ctx.textAlign = "left";

    handleDescDrawBackground.call(this, ctx);
};

ArithmeticOperator.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return [sourceProperty(this, "type") + " " + output[1]];
};
ArithmeticOperator.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + this.operation + input[2] + ";";
};
ArithmeticOperator.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
ArithmeticOperator.prototype.onDrawTitleBox = handleDrawTitleBox;

function extend(ChildClass: NodeFunction, ParentClass: NodeFunction): NodeFunction {
    ChildClass.prototype = new (ParentClass as NodeFunction & {new (): NativeNode})();
    ChildClass.prototype.constructor = ChildClass;
    return ChildClass;
}

/// Add

function Add(this: NativeNode) {
    this.operation = "+";
    this.iconName = "plus";
    this.desc = "Add two numbers";
    this.init!();
}


/// Subtract

function Subtract(this: NativeNode) {
    this.operation = "-";
    this.iconName = "minus";
    this.desc = "Subtract two numbers";
    this.init!();
}


/// Multiply

function Multiply(this: NativeNode) {
    this.operation = "*";
    this.iconName = "times";
    this.desc = "Multiply two numbers";
    this.init!();
}


/// Divide

function Divide(this: NativeNode) {
    this.operation = "/";
    this.iconName = "divide";
    this.desc = "Divide two numbers";
    this.init!();
}


/// Modulus

function Modulus(this: NativeNode) {
    this.operation = "%";
    this.iconName = "percentage";
    this.desc = "Calculate the modulus of two numbers";
    this.init!();
}

export = [
    extend(Add, ArithmeticOperator),
    extend(Subtract, ArithmeticOperator),
    extend(Multiply, ArithmeticOperator),
    extend(Divide, ArithmeticOperator),
    extend(Modulus, ArithmeticOperator)
] satisfies NodeModule;
