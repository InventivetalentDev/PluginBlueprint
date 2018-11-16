const Colors = require("../colors");

// String Constant

function StringConstant() {
    this.classType = "native";
    this.addOutput("", "java.lang.String", {color_off: Colors.STRING_OFF, color_on: Colors.STRING_ON});
    this.addProperty("string", "", "string");
}

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
    this.addOutput("", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addProperty("number", 0, "number");
}

NumberConstant.prototype.color = Colors.NUMBER_OFF;
NumberConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.type + " " + this.properties.number;
    this.outputs[0].type = this.properties.type;
};
NumberConstant.prototype.getFields = function (output) {
    return [this.properties.type + " " + output[0] + " = " + this.properties.number];
}

// Boolean Constant

function BooleanConstant() {
    this.classType = "native";
    this.addOutput("", "boolean", {color_off: Colors.BOOLEAN_OFF, color_on: Colors.BOOLEAN_ON});
    this.addProperty("value", false, "boolean");
}

BooleanConstant.prototype.color = Colors.BOOLEAN_OFF;
BooleanConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = "" + this.properties.value;
};
BooleanConstant.prototype.getFields = function (output) {
    return ["boolean " + output[0] + " = " + this.properties.value];
};

// Null Constant

function Null() {
    this.classType = "native";
    this.addOutput("null", null, {color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON});
}

Null.prototype.color = Colors.OBJECT_OFF;
Null.prototype.getFields = function (output) {
    return ["java.lang.Object " + output[0] + " = null"];
};


module.exports = [
    StringConstant,
    NumberConstant,
    BooleanConstant,
    Null
];