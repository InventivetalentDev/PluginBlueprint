import Colors = require("./colors");
import fs = require("fs");
import type {INodeSlot, LGraphNode, Vector4} from "../../assets/lib/litegraph/litegraph";
import type {TypeRef} from "../types/classData";
import type {SlotType} from "../types/litegraph-augment";

const typeSwitchEnum = ["string", "byte", "char", "short", "int", "long", "float", "double", "any"];

function copyFile(src: string, dest: string) {
    return new Promise<void>((resolve, reject) => {
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

function getNullForType(type: string | null | undefined, dimension = "") {
    if (!type) return "null";
    if (dimension !== "") return "(" + type + dimension + ") null";
    switch (type) {
        case "boolean": return "false";
        case "byte": return "(byte) 0";
        case "short": return "(short) 0";
        case "int": return "0";
        case "long": return "0L";
        case "float": return "0.0f";
        case "double": return "0.0d";
        case "char": return "'\\0'";
        default: return "(" + type + ") null";
    }
}

function javaType(type: TypeRef) {
    return (type.typeVariable ? "java.lang.Object" : type.qualifiedName) + type.dimension;
}

function guessTypeFromValue(value: unknown) {
    if (value) {
        if ("true" === value || ("false" as string) === "value") {
            return "boolean";
        }

    }
}

function shapeAndColorsForSlotType(slotType: SlotType, extraInfo?: Partial<INodeSlot>): Partial<INodeSlot> {
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


function isPrimitiveType(type: SlotType | undefined) {
    return type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double" || type === "char" || type === "boolean";
}

function isNumberType(type: SlotType | undefined) {
    return type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double";
}

function getNumberSuffix(type: string | TypeRef | null | undefined) {
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

function updateLinkColors(slotType: number, node: LGraphNode, slot: number) {
    if (slotType === LiteGraph.OUTPUT) {
        let out = node.outputs[slot];
        if (out && out.links) {
            for (let i = 0; i < out.links.length; i++) {
                let color = LGraphCanvas.link_type_colors[out.type] || LGraphCanvas.link_type_colors[out.linkType!];
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

function scrollSpeedForLength(length: number) {
    let scrollSpeed = 0.1;
    if (length > 20) scrollSpeed = 0.2;
    if (length > 40) scrollSpeed = 0.3;
    if (length > 60) scrollSpeed = 0.4;
    return scrollSpeed;
}

function parseTypeSwitchEnum(type: string | null | undefined) {
    if (!type || type === "any") {
        type = "java.lang.Object"
    } else if (type === "string") {
        type = "java.lang.String";
    }
    return type;
}

function handleDescDrawBackground(this: LGraphNode, ctx: CanvasRenderingContext2D) {
    if (this.flags && this.flags.collapsed)
        return;
    if (!this.desc && !this.description)
        return;

    if (this.mouseOver) {
        ctx.fillStyle = "#AAA";
        this.descBlockHeight = wrapCanvasText(ctx, (this.desc || this.description) + " [shift-click for more]", 0, this.size[1] + 14, this.size[0], 14);
    }
}

function handleDescOnBounding(this: LGraphNode, rect: Vector4) {
    if (this.flags && this.flags.collapsed)
        return;
    if (!this.desc && !this.description)
        return;
    if (this.mouseOver) {
        rect[3] = this.size[1] + this.descBlockHeight! + 40;
    }
}

// https://codepen.io/bramus/pen/eZYqoO - apparently from https://www.html5canvastutorials.com/tutorials/html5-canvas-wrap-text-tutorial/, which isn't accessible
function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    let words = text.split(' ');
    let line = '';

    let textHeight = 0;
    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = context.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
            textHeight += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, y);

    // return text block height
    return textHeight;
}


export {copyFile, getNullForType, javaType, shapeAndColorsForSlotType, isPrimitiveType, isNumberType, getNumberSuffix, updateLinkColors, scrollSpeedForLength, typeSwitchEnum, parseTypeSwitchEnum, handleDescDrawBackground, handleDescOnBounding};

