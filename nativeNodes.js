// String Constant

function StringConstant() {
    this.classType = "native";
    this.addOutput("", "java.lang.String");
    this.addProperty("string", "");
}

StringConstant.title = "String Constant";
StringConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.string;
};
StringConstant.prototype.getNativeType = function () {
    return "java.lang.String";
};
StringConstant.prototype.getOutputCode = function () {
    return "\"" + this.properties.string + "\"";
};

// Number Constant

function NumberConstant() {
    this.classType = "native";
    this.addOutput("", "int");
    this.addProperty("type", "int", "enum", {values: ["byte", "char", "short", "int", "long", "float", "double"]});
    this.addProperty("number", 0);
}

NumberConstant.title = "Number Constant";
NumberConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.type + " " + this.properties.number;
    this.outputs[0].type = this.properties.type;
};
NumberConstant.prototype.getNativeType = function () {
    return this.properties.type;
};
NumberConstant.prototype.getOutputCode = function () {
    return this.number;
};

// Boolean Constant

function BooleanConstant() {
    this.classType = "native";
    this.addOutput("", "boolean");
    this.addProperty("value", false);
}

BooleanConstant.title = "BooleanConstant";
BooleanConstant.prototype.onDrawBackground = function () {
    this.outputs[0].label = this.properties.value;
};
BooleanConstant.prototype.getNativeType = function () {
    return "boolean";
};
BooleanConstant.prototype.getOutputCode = function () {
    return this.value;
};

module.exports = [
    StringConstant,
    NumberConstant,
    BooleanConstant
];