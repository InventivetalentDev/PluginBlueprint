const Colors = require("../colors");
const {shapeAndColorsForSlotType, isPrimitiveType} = require("../util");


// Switch

function Switch() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("True (if)", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("False (else)", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("Condition", "boolean", shapeAndColorsForSlotType("boolean"));
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

module.exports = [
    Switch
];