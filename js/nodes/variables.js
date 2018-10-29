const Colors = require("../colors");

function Set() {
    this.classType = "native";
    this.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    this.addInput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
}

Set.prototype.onDrawBackground = function () {
    this.inputs[1].label = this.properties.name;
};
Set.prototype.getFields = function (output) {
    return ["java.lang.Object " + this.properties.name];// TODO: support for primitive types
}
Set.prototype.getMethodBody = function (input, output) {
    return this.properties.name + " = " + input[1] + ";";
}


function Get() {
    this.classType = "native";
    this.addOutput("myVariable", null);
    this.addProperty("name", "myVariable", "string");
}

Get.prototype.onDrawBackground = function () {
    this.outputs[1].label = this.properties.name;
};
Get.prototype.getMethodBody = function (input, output) {
    return output[1] + " = " + this.propeties.name + ";";
};


module.exports=[
    Set,
    Get
];