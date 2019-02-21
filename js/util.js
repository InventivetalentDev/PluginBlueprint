const Colors = require("./colors");
const fs = require("fs");

const typeSwitchEnum = ["string", "byte", "char", "short", "int", "long", "float", "double", "any"];

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
    if (slotType === "staticMethod") {
        return Object.assign({}, {
            shape: LiteGraph.BOX_SHAPE,
            color_on: Colors.STATIC_FUNCTION_ON,
            color_off: Colors.STATIC_FUNCTION_OFF
        }, extraInfo);
    }
    if (slotType === "enum") {
        return Object.assign({}, {
            color_on: Colors.ENUM_ON,
            color_off: Colors.ENUM_OFF
        }, extraInfo);
    }
    if (slotType === "REF" || slotType === "THIS" || slotType === "object") {
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

function getNumberSuffix(type) {
    if (type) {
        if (typeof type !== "string") {
            type = type.qualifiedName;
        }
        if (type === "float") {
            return "F";
        }
        if (type === "double") {
            return "D";
        }
        if (type === "long") {
            return "L";
        }
    }
    return "";
}

function updateLinkColors(slotType, node, slot) {
    if (slotType === LiteGraph.OUTPUT) {
        let out = node.outputs[slot];
        if (out && out.links) {
            for (let i = 0; i < out.links.length; i++) {
                let color = LGraphCanvas.link_type_colors[out.type] || LGraphCanvas.link_type_colors[out.linkType];
                if (color) {
                    let link = graph.links[out.links[i]];
                    if (link) {
                        link.color = color;
                    }
                }
            }
        }
    }
}

function scrollSpeedForLength(length) {
    let scrollSpeed = 0.1;
    if (length > 20) scrollSpeed = 0.2;
    if (length > 40) scrollSpeed = 0.3;
    if (length > 60) scrollSpeed = 0.4;
    return scrollSpeed;
}

function parseTypeSwitchEnum(type) {
    if (!type || type === "any") {
        type = "java.lang.Object"
    } else if (type === "string") {
        type = "java.lang.String";
    }
    return type;
}

function handleDescDrawBackground(ctx) {
    if (this.flags.collapsed)
        return;
    if (!this.desc && !this.description)
        return;

    if (this.mouseOver) {
        ctx.fillStyle = "#AAA";
        ctx.fillText(this.desc || this.description, 0, this.size[1] + 14);
    }
}

function handleDescOnBounding(rect) {
    if (!this.flags.collapsed && this.mouseOver)
        rect[3] = this.size[1] + 20;
}


module.exports = {copyFile, getNullForType, shapeAndColorsForSlotType, isPrimitiveType, isNumberType, getNumberSuffix, updateLinkColors, scrollSpeedForLength, typeSwitchEnum, parseTypeSwitchEnum, handleDescDrawBackground, handleDescOnBounding};

