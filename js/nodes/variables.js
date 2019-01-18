const Colors = require("../colors");
const {shapeAndColorsForSlotType} = require("../util");

function Set() {
    this.classType = "native";
    this.iconName = "sign-in-alt";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
    this.addProperty("type", "string", "enum", {values: ["string", "byte", "char", "short", "int", "long", "float", "double", "any"]})
}

Set.prototype.onDrawBackground = function () {
    this.inputs[1].label = this.properties.name;
    this.inputs[1].type = parseType(this.properties.type);
};
Set.prototype.getFields = function (output) {
    return [parseType(this.properties.type) + " " + this.properties.name];
};
Set.prototype.getMethodBody = function (input, output) {
    return this.properties.name + " = " + input[1] + ";";
};
Set.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;


function Get() {
    this.classType = "native";
    this.iconName = "sign-out-alt";
    this.addOutput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
    this.addProperty("type", "string", "enum", {values: ["string", "byte", "char", "short", "int", "long", "float", "double", "any"]})
}

Get.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.name;
    this.outputs[0].type = parseType(this.properties.type);
};
Get.prototype.getMethodBody = function (input, output) {
    return output[0] + " = " + this.properties.name + ";";
};
Get.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;

function parseType(type) {
    if (!type || type === "any") {
        type = "java.lang.Object"
    } else if (type === "string") {
        type = "java.lang.String";
    }
    return type;
}


module.exports = [
    Set,
    Get
];