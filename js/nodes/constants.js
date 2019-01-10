const Colors = require("../colors");
const {shapeAndColorsForSlotType, getNumberSuffix} = require("../util");

// String Constant

function StringConstant() {
    this.classType = "native";
    this.iconName = "align-left";
    this.addOutput("", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    this.addProperty("string", "", "string");
}

StringConstant.prototype.color = Colors.STRING_OFF;
StringConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.string;
};
StringConstant.prototype.getFields = function (output) {
    return ["java.lang.String " + output[0] + " = \"" + this.properties.string + "\""];
};
StringConstant.prototype.onPropertyChanged = function (k, p) {
    this.size = this.computeSize();
};
StringConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Number Constant

function NumberConstant() {
    this.classType = "native";
    this.iconName = "sort-numeric-down";//TODO: find a better icon
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
    return [this.properties.type + " " + output[0] + " = " + this.properties.number + getNumberSuffix(this.properties.type)];
};
NumberConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Boolean Constant

function BooleanConstant() {
    this.classType = "native";
    this.iconName = "toggle-on";
    this.addOutput("", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addProperty("value", false, "boolean");
}

BooleanConstant.prototype.color = Colors.BOOLEAN_OFF;
BooleanConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = "" + this.properties.value;
};
BooleanConstant.prototype.getFields = function (output) {
    return ["boolean " + output[0] + " = " + this.properties.value];
};
BooleanConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Null Constant

function Null() {
    this.classType = "native";
    this.addOutput("null", null, shapeAndColorsForSlotType("object"));
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