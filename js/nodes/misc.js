const Colors = require("../colors");


// Cast

function Cast() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("", null);
    this.addOutput("", null);
    this.addProperty("castTo", "java.lang.Object", "string");
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
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("True", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("False", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("boolean", "boolean");
}

Switch.title = "Switch";
Switch.prototype.getMethodBody = function (input, output) {
    return "boolean val = " + input[1] + ";";
};
Switch.prototype.getExecAfter = function (exec) {
    return "if(val) {\n" +
        exec[0].join("\n") + "//True\n" +
        "} else {\n" +
        exec[1].join("\n") + "//False\n" +
        "}";
};

// String formatting

function StringFormat() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("Format", "java.lang.String");
    this.addInput("Variable", null);
    this.addOutput("Formatted", "java.lang.String");

    this.optional_inputs = [["Variable", null, {}]];
}

StringFormat.title = "StringFormat";
StringFormat.prototype.getFields = function (output) {
    return ["java.lang.String " + output[1]];// Formatted
}
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
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
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
    Cast,
    Switch,

    StringFormat,

    ConsoleLog
];