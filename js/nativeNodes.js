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
StringConstant.prototype.getFields = function (output) {
    return ["java.lang.String " + output[0] + " = \"" + this.properties.string + "\""];
}

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
NumberConstant.prototype.getFields = function (output) {
    return [this.type + " " + output[0] + " = " + this.properties.number];
}

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
BooleanConstant.prototype.getFields = function (output) {
    return ["boolean " + output[0] + "= " + this.properties.value];
}

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
Cast.prototype.getFields = function (output) {
    return [this.properties.castTo + " " + output[1]];
}
Cast.prototype.getMethodBody = function (input, output) {
    return output[1] + " = (" + this.properties.castTo + ") " + input[1] + ";";
};
Cast.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};

// Switch

function Switch() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addOutput("True", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addOutput("False", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addInput("boolean", "boolean");
}

Switch.title = "Switch";
Switch.prototype.getMethodBody = function (input, output) {
    return "boolean val = " + input[1] + ";";
};
Switch.prototype.getExecAfter = function (exec) {
    return  "if(val) {\n" +
        exec[0].join("\n") + "//True\n" +
        "} else {\n" +
        exec[1].join("\n") + "//False\n" +
        "}";
};

// Console Log

function ConsoleLog() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    this.addInput("", null);
}

ConsoleLog.title = "ConsoleLog";
ConsoleLog.prototype.getFields = function (output) {
    return [];
}
ConsoleLog.prototype.getMethodBody = function (input, output) {
    return "java.lang.System.out.println(" + input[1] + ");";
};


module.exports = [
    StringConstant,
    NumberConstant,
    BooleanConstant,

    Cast,
    Switch,

    ConsoleLog
];