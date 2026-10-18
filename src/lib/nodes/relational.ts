import Colors = require("../colors");
import {shapeAndColorsForSlotType, handleDescDrawBackground} from "../util";
import type {NativeNode, NodeModule, NodeFunction} from "../../types/nodes";

type RelationalInput = {type: NativeNode["inputs"][number]["type"] | undefined};

const RelationalOperator: NodeFunction = function (this: NativeNode) {
    this.classType = "native";
    this.operation = "?";
};

RelationalOperator.prototype.init = function (this: NativeNode, booleanInputs?: boolean): void {
    this.desc = "Compare two numbers";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    if (booleanInputs) {
        this.addInput("A", "boolean,byte,char,short,int,long,float,double", {color_off: Colors.BOOLEAN_OFF, color_on: Colors.BOOLEAN_ON});
        this.addInput("B", "boolean,byte,char,short,int,long,float,double", {color_off: Colors.BOOLEAN_OFF, color_on: Colors.BOOLEAN_ON});
    } else {
        this.addInput("A", "byte,char,short,int,long,float,double", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
        this.addInput("B", "byte,char,short,int,long,float,double", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    }
    this.addOutput(this.operation!, "boolean", shapeAndColorsForSlotType("boolean"));
};

RelationalOperator.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    (this.inputs[1] as RelationalInput).type = this.properties.type;
    (this.inputs[2] as RelationalInput).type = this.properties.type;
    //TODO: should probably also update the color to boolean/number

    if (this.flags.collapsed)
        return;

    ctx.font = "40px Arial";
    ctx.fillStyle = "#CCC";
    ctx.textAlign = "center";
    ctx.fillText(this.operation!, this.size[0] * 0.5, this.size[1] * 0.5 + 10);
    ctx.textAlign = "left";

    handleDescDrawBackground.call(this, ctx);
};

RelationalOperator.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    return ["boolean " + output[1]];
};
RelationalOperator.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    return output[1] + " = " + input[1] + this.operation + input[2] + ";";
};
RelationalOperator.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};

function extend(ChildClass: NodeFunction, ParentClass: NodeFunction): NodeFunction {
    ChildClass.prototype = new (ParentClass as NodeFunction & {new (): NativeNode})();
    ChildClass.prototype.constructor = ChildClass;
    return ChildClass;
}


/// Equal

function Equal(this: NativeNode) {
    this.operation = "==";
    this.init!(true);
}

/// NotEqual

function NotEqual(this: NativeNode) {
    this.operation = "!=";
    this.init!(true);
}

/// GreaterThan

function GreaterThan(this: NativeNode) {
    this.operation = ">";
    this.init!();
}

/// GreaterEqualThan

function GreaterEqualTo(this: NativeNode) {
    this.operation = ">=";
    this.init!();
}

/// LessThan

function LessThan(this: NativeNode) {
    this.operation = "<";
    this.init!();
}

/// LessEqualTo

function LessEqualTo(this: NativeNode) {
    this.operation = "<=";
    this.init!();
}


export = [
    extend(Equal, RelationalOperator),
    extend(NotEqual, RelationalOperator),
    extend(GreaterThan, RelationalOperator),
    extend(GreaterEqualTo, RelationalOperator),
    extend(LessThan, RelationalOperator),
    extend(LessEqualTo, RelationalOperator)
] satisfies NodeModule;