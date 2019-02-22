const Colors = require("../colors");
const {shapeAndColorsForSlotType, getNumberSuffix, handleDescDrawBackground} = require("../util");

// String Constant

function StringConstant() {
    this.classType = "native";
    this.desc = "A constant String";
    this.iconName = "align-left";
    this.addOutput("", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    this.addProperty("string", "", "string");
}

StringConstant.prototype.color = Colors.STRING_OFF;
StringConstant.prototype.getFields = function (output) {
    return ["java.lang.String " + output[0] + " = \"" + this.properties.string + "\""];
};
StringConstant.prototype.onPropertyChanged = function (k, p) {
    this.outputs[0].label = this.properties.string;
    this.size = this.computeSize();
};
StringConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Number Constant

function NumberConstant() {
    this.classType = "native";
    this.desc = "A constant Number";
    this.iconName = "sort-numeric-down";//TODO: find a better icon
    this.addOutput("", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addProperty("number", 0, "number");
}

NumberConstant.prototype.color = Colors.NUMBER_OFF;
NumberConstant.prototype.getFields = function (output) {
    return [this.properties.type + " " + output[0] + " = " + this.properties.number + getNumberSuffix(this.properties.type)];
};
NumberConstant.prototype.onPropertyChanged = function (k, p) {
    this.outputs[0].label = this.properties.type + " " + this.properties.number;
    this.outputs[0].type = this.properties.type;
    this.size = this.computeSize();
};
NumberConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Boolean Constant

function BooleanConstant() {
    this.classType = "native";
    this.desc = "A constant boolean";
    this.iconName = "toggle-on";
    this.addOutput("", "boolean", shapeAndColorsForSlotType("boolean"));
    this.addProperty("value", false, "boolean");
}

BooleanConstant.prototype.color = Colors.BOOLEAN_OFF;
BooleanConstant.prototype.getFields = function (output) {
    return ["boolean " + output[0] + " = " + this.properties.value];
};
BooleanConstant.prototype.onPropertyChanged = function (k, p) {
    this.outputs[0].label = "" + this.properties.value;
    this.size = this.computeSize();
};
BooleanConstant.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

// Null Constant

function Null() {
    this.classType = "native";
    this.desc = "Null constant";
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