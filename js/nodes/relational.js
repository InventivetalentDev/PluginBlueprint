const Colors = require("../colors");
const {shapeAndColorsForSlotType, handleDescDrawBackground} = require("../util");

const RelationalOperator = function () {
    this.classType = "native";
    this.operation = "?";
};

RelationalOperator.prototype.init = function (booleanInputs) {
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
    this.addOutput(this.operation, "boolean", shapeAndColorsForSlotType("boolean"));
};

RelationalOperator.prototype.onDrawBackground = function (ctx) {
    this.inputs[1].type = this.properties.type;
    this.inputs[2].type = this.properties.type;
    //TODO: should probably also update the color to boolean/number

    if (this.flags.collapsed)
        return;

    ctx.font = "40px Arial";
    ctx.fillStyle = "#CCC";
    ctx.textAlign = "center";
    ctx.fillText(this.operation, this.size[0] * 0.5, this.size[1] * 0.35 + LiteGraph.NODE_TITLE_HEIGHT);
    ctx.textAlign = "left";

    handleDescDrawBackground(ctx);
};

RelationalOperator.prototype.getFields = function (output) {
    return ["boolean " + output[1]];
};
RelationalOperator.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + this.operation + input[2] + ";";
};
RelationalOperator.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};

function extend(ChildClass, ParentClass) {
    ChildClass.prototype = new ParentClass();
    ChildClass.prototype.constructor = ChildClass;
    return ChildClass;
}


/// Equal

function Equal() {
    this.operation = "==";
    this.init(true);
}

/// NotEqual

function NotEqual() {
    this.operation = "!=";
    this.init(true);
}

/// GreaterThan

function GreaterThan() {
    this.operation = ">";
    this.init();
}

/// GreaterEqualThan

function GreaterEqualTo() {
    this.operation = ">=";
    this.init();
}

/// LessThan

function LessThan() {
    this.operation = "<";
    this.init();
}

/// LessEqualTo

function LessEqualTo() {
    this.operation = "<=";
    this.init();
}


module.exports = [
    extend(Equal, RelationalOperator),
    extend(NotEqual, RelationalOperator),
    extend(GreaterThan, RelationalOperator),
    extend(GreaterEqualTo, RelationalOperator),
    extend(LessThan, RelationalOperator),
    extend(LessEqualTo, RelationalOperator)
];