const Colors = require("./colors");
const fs = require("fs");

function copyFile(src, dest) {
    return new Promise((resolve, reject) => {
        console.debug("copy ", src, "->", dest);
        if (!fs.existsSync(src)) {
            reject();
            return;
        }
        let rs = fs.createReadStream(src);
        let ws = fs.createWriteStream(dest);
        ws.on("close", function () {
            resolve();
        });
        ws.on("error", function () {
            reject();
        });
        rs.pipe(ws);
    })
}

function getNullForType(type) {
    if (type) {
        if (typeof type !== "string") {
            type = type.qualifiedName;
        }
        if (type === "boolean") {
            return "false";
        }
        if (type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double") {
            return "0";
        }
        if (type === "char") {
            return "''";
        }
    }
    return "null";
}

function guessTypeFromValue(value) {
    if (value) {
        if ("true" === value || "false" === "value") {
            return "boolean";
        }

    }
}

function shapeAndColorsForSlotType(slotType, extraInfo) {
    if (!extraInfo) extraInfo = {};

    if (slotType === "@EXEC") {
        return Object.assign({}, {
            shape: LiteGraph.ARROW_SHAPE,
            color_on: Colors.EXEC_ON,
            color_off: Colors.EXEC_OFF
        }, extraInfo);
    }
    if (slotType === "method") {
        return Object.assign({}, {
            shape: LiteGraph.BOX_SHAPE,
            color_on: Colors.FUNCTION_ON,
            color_off: Colors.FUNCTION_OFF
        }, extraInfo);
    }
    if (slotType === "abstractMethod") {
        return Object.assign({}, {
            shape: LiteGraph.BOX_SHAPE,
            color_on: Colors.ABSTRACT_FUNCTION_ON,
            color_off: Colors.ABSTRACT_FUNCTION_OFF
        }, extraInfo);
    }
    if (slotType === "enum") {
        return Object.assign({}, {
            color_on: Colors.ENUM_ON,
            color_off: Colors.ENUM_OFF
        }, extraInfo);
    }
    if (slotType === "REF"||slotType === "THIS"||slotType === "object") {
        return Object.assign({}, {
            shape: LiteGraph.BOX_SHAPE,
            color_on: Colors.OBJECT_ON,
            color_off: Colors.OBJECT_OFF
        }, extraInfo);
    }
    if (slotType === "boolean") {
        return Object.assign({}, {
            color_on: Colors.BOOLEAN_ON,
            color_off: Colors.BOOLEAN_OFF
        }, extraInfo);
    }
    if (isNumberType(slotType)) {
        return Object.assign({}, {
            color_on: Colors.NUMBER_ON,
            color_off: Colors.NUMBER_OFF
        }, extraInfo);
    }
    if (slotType === "java.lang.String") {
        return Object.assign({}, {
            color_on: Colors.STRING_ON,
            color_off: Colors.STRING_OFF
        }, extraInfo);
    }

    return Object.assign({}, extraInfo);
}


function isPrimitiveType(type) {
    return type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double" || type === "char" || type === "boolean";
}

function isNumberType(type) {
    return type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double";
}

module.exports = {copyFile, getNullForType, shapeAndColorsForSlotType, isPrimitiveType, isNumberType};

