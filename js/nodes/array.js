const Colors = require("../colors");

function SetIndex() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("Array", null);
    this.addInput("index", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
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
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("Array", null);
    this.addInput("index", "int", {color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
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
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("Array", null);
    this.addOutput("length", "int");
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