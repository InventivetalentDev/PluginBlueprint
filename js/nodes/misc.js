const Colors = require("../colors");
const {shapeAndColorsForSlotType, isPrimitiveType, handleDescDrawBackground} = require("../util");


// Cast

function Cast() {
    this.classType = "native";
    this.desc = "Cast an object to another";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("", null);
    this.addOutput("", null);
    this.addProperty("castTo", "java.lang.Object", "string");
}

Cast.title = "Cast";
Cast.prototype.onDrawBackground = function (ctx) {
    this.outputs[1].label = "(" + this.properties.castTo + ")";
    handleDescDrawBackground.call(this, ctx);
};
Cast.prototype.getFields = function (output) {
    return [this.properties.castTo + " " + output[1]];
};
Cast.prototype.getMethodBody = function (input, output) {
    return output[1] + " = (" + this.properties.castTo + ") " + input[1] + ";";
};
Cast.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};


// InstanceOf

function InstanceOf() {
    this.classType = "native";
    this.desc = "Check if an object is an instance of a class";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    this.addInput("", null, shapeAndColorsForSlotType("object"));

    this.addOutput("instanceof java.lang.Object", "boolean", shapeAndColorsForSlotType("boolean"));

    this.addProperty("type", "java.lang.Object", "string");
}

InstanceOf.title = "InstanceOf";
InstanceOf.prototype.onDrawBackground = function (ctx) {
    this.outputs[1].label = "instanceof " + this.properties.type;
    handleDescDrawBackground.call(this, ctx);
};
InstanceOf.prototype.getFields = function (output) {
    return ["boolean " + output[1]];
};
InstanceOf.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + " instanceof " + this.properties.type + ";";
};
InstanceOf.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};

// String formatting

function StringFormat() {
    this.classType = "native";
    this.desc = "Format a string containing placeholders (%s) with variables";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Format", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));
    this.addInput("Variable", null);
    this.addOutput("Formatted", "java.lang.String", shapeAndColorsForSlotType("java.lang.String"));

    this.optional_inputs = [["Variable", null, {}]];
}

StringFormat.title = "StringFormat";
StringFormat.prototype.getFields = function (output) {
    return ["java.lang.String " + output[1]];// Formatted
};
StringFormat.prototype.getMethodBody = function (input, output) {
    let variableInputs = input.slice(2);
    return output[1] + " = java.lang.String.format(" + input[1] + ", " + variableInputs.join(",") + ");";
};
StringFormat.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};
StringFormat.prototype.getMenuOptions = function () {
    return [
        {content: "Inputs", has_submenu: true, disabled: false, callback: LGraphCanvas.showMenuNodeOptionalInputs}
    ];
};


// Console Log

function ConsoleLog() {
    this.classType = "native";
    this.desc = "Log something to the console";
    this.iconName = "print";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("", null);
}

ConsoleLog.title = "ConsoleLog";
ConsoleLog.prototype.getFields = function (output) {
    return [];
};
ConsoleLog.prototype.getMethodBody = function (input, output) {
    return "java.lang.System.out.println(" + input[1] + ");";
};
ConsoleLog.prototype.onDrawTitleBox = require("../fontAwesomeHelper").handleDrawTitleBox;


module.exports = [
    Cast,
    InstanceOf,

    StringFormat,

    ConsoleLog
];