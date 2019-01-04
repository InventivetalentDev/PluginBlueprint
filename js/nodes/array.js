const Colors = require("../colors");
const {shapeAndColorsForSlotType} = require("../util");

function SetIndex() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Array", null);
    this.addInput("index", "int", shapeAndColorsForSlotType("int"));
    this.addInput("Value", null);
}

SetIndex.prototype.getMethodBody = function (input, output) {
    return input[1] + "[" + input[2] + "] = " + input[3] + ";";
};
SetIndex.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};


function GetIndex() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Array", null);
    this.addInput("index", "int", shapeAndColorsForSlotType("int"));
    this.addOutput("Value", null);
}

GetIndex.prototype.getFields = function (output) {
    return ["java.lang.Object " + output[1]];
}

GetIndex.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + "[" + input[2] + "];";
};
GetIndex.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};


function Length() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Array", null);
    this.addOutput("length", "int",shapeAndColorsForSlotType("int"));
}

Length.prototype.getFields = function (output) {
    return ["int " + output[1]];
}

Length.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + input[1] + ".length;";
};
Length.prototype.getExecAfter = function (exec) {
    return exec[0].join("\n");
};



module.exports = [
    SetIndex,
    GetIndex,
    Length
];