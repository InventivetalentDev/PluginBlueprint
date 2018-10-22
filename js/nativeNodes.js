const Colors = require("./colors");

// String Constant

function StringConstant() {
    this.classType = "native";
    this.addOutput("", "java.lang.String", {colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
    this.addProperty("string", "");
}

StringConstant.title = "String Constant";
StringConstant.prototype.color = Colors.STRING_OFF;
StringConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.string;
};
StringConstant.prototype.getNativeType = function () {
    return "java.lang.String";
};
StringConstant.prototype.getOutputIndex = function () {
    return 0;
};
StringConstant.prototype.getOutputCode = function () {
    return "\"" + this.properties.string + "\"";
};

// Number Constant

function NumberConstant() {
    this.classType = "native";
    this.addOutput("", "int", {colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addProperty("number", 0);
}

NumberConstant.title = "Number Constant";
NumberConstant.prototype.color = Colors.NUMBER_OFF;
NumberConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.type + " " + this.properties.number;
    this.outputs[0].type = this.properties.type;
};
NumberConstant.prototype.getNativeType = function () {
    return this.properties.type;
};
NumberConstant.prototype.getOutputIndex = function () {
    return 0;
};
NumberConstant.prototype.getOutputCode = function () {
    return this.properties.number;
};

// Boolean Constant

function BooleanConstant() {
    this.classType = "native";
    this.addOutput("", "boolean", {colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
    this.addProperty("value", false);
}

BooleanConstant.title = "BooleanConstant";
BooleanConstant.prototype.color = Colors.BOOLEAN_OFF;
BooleanConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.value;
};
BooleanConstant.prototype.getNativeType = function () {
    return "boolean";
};
BooleanConstant.prototype.getOutputIndex = function () {
    return 0;
};
BooleanConstant.prototype.getOutputCode = function () {
    return this.properties.value;
};

// Cast

function Cast() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addInput("", null);
    this.addOutput("", null);
    this.addProperty("castTo", "java.lang.Object");
}

Cast.title = "Cast";
Cast.prototype.onDrawBackground = function () {
    this.outputs[1].label = "(" + this.properties.castTo + ")";
};
Cast.prototype.getNativeType = function () {
    return this.properties.castTo;
};
Cast.prototype.getOutputIndex = function () {
    return 1;
};
Cast.prototype.getOutputCode = function (input) {
    return "(" + this.properties.castTo + ") " + input + ";";
};

// Console Log

function ConsoleLog() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addInput("", null);
}

ConsoleLog.title = "ConsoleLog";
ConsoleLog.prototype.getNativeType = function () {
    return "";
};
ConsoleLog.prototype.getOutputIndex = function () {
    return -1;
};
ConsoleLog.prototype.getOutputCode = function (input) {
    return "System.out.println(" + input + ");";
};


module.exports = [
    StringConstant,
    NumberConstant,
    BooleanConstant,

    Cast,

    ConsoleLog
];