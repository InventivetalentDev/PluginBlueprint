const Colors = require("../colors");
const {shapeAndColorsForSlotType, isPrimitiveType} = require("../util");

// NotGate

function NotGate() {
    this.classType = "native";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("IN", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

NotGate.title = "NotGate";
NotGate.prototype.getFields = function (output) {
    return ["boolean " + output[1]];
};
NotGate.prototype.getMethodBody = function (input, output) {
    return output[1] + " = !" + input[1] + ";\n";
};
NotGate.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};


// AndGate

function AndGate() {
    this.classType = "native";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("A", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addInput("B", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

AndGate.title = "AndGate";
AndGate.prototype.getFields = function (output) {
    return ["boolean " + output[1]];
};
AndGate.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + " && " + input[2] + ";\n";
};
AndGate.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};


// OrGate

function OrGate() {
    this.classType = "native";

    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("A", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addInput("B", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("OUT", "boolean", shapeAndColorsForSlotType("boolean"));
}

OrGate.title = "OrGate";
OrGate.prototype.getFields = function (output) {
    return ["boolean " + output[1]];
};
OrGate.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + " || " + input[2] + ";\n";
};
OrGate.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};

module.exports = [
    NotGate,
    AndGate,
    OrGate
];