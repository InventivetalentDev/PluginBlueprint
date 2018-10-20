const fs = require("fs");
const {LiteGraph} = require("litegraph.js");
const Colors = require("./colors");

const classesByName = [];

const fields = [];
const eventListenerMethods = [];
const objectMethods = [];
const enumMethods = [];
const generatedMethods = [];
const methodCalls = [];
const nativeCalls = [];

function generateClassCode(graph) {
    for (let i = 0; i < graph._nodes.length; i++) {
        if (graph._nodes[i].constructor.name === "BukkitClassNode") {
            if (graph._nodes[i].classType === "event") {
                generateCodeForEventClassNode(i, graph._nodes[i]);
            }
            if (graph._nodes[i].classType === "object") {
                generateCodeForObjectClassNode(i, graph._nodes[i]);
            }
            if (graph._nodes[i].classType === "enum") {
                generateCodeForEnumClassNode(i, graph._nodes[i]);
            }
        } else if (graph._nodes[i].constructor.name === "BukkitMethodNode") {
            generateCodeForMethodNode(i, graph._nodes[i]);
        } else {
            if (graph._nodes[i].classType === "native") {
                generateCodeForNativeNode(i, graph._nodes[i]);
            }
        }
    }


    let classCode = "" +
        "package org.inventivetalent.pluginblueprint.generated;\n" +//TODO: custom package name
        "\n" +
        "public class GeneratedPlugin extends org.bukkit.plugin.java.JavaPlugin implements org.bukkit.event.Listener {\n" +
        "\n" +
        fields.join("\n") +
        "\n\n" +
        "@java.lang.Override\n" +
        "public void onEnable() {\n" +
        "getServer().getPluginManager().registerEvents(this, this);\n" +
        "\n" +//TODO
        "}\n" +
        "\n" +
        eventListenerMethods.join("\n") +
        "\n\n" +
        objectMethods.join("\n") +
        "\n\n" +
        enumMethods.join("\n") +
        "\n\n" +
        generatedMethods.join("\n") +
        "\n\n" +
        methodCalls.join("\n") +
        "\n\n" +
        nativeCalls.join("\n") +
        "\n" +
        "}\n";

    console.log(classCode);

    // Reset
    fields.splice(0, fields.length);
    eventListenerMethods.splice(0, eventListenerMethods.length);
    generatedMethods.splice(0, generatedMethods.length);
    objectMethods.splice(0, objectMethods.length);
    enumMethods.splice(0, objectMethods.length);
    methodCalls.splice(0, methodCalls.length);
    nativeCalls.splice(0, nativeCalls.length);
}

function generateCodeForEventClassNode(n, node) {
    let code = "" +
        "@org.bukkit.event.EventHandler\n" +
        "public void on(" + node.type + " event) {\n";

    fields.push("private " + node.type + " node_" + node.id + ";");
    code += "  node_" + node.id + " = event;\n";

    // temporary variable so we can append the execution AFTER assigning variables
    let execCode = "";

    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {

            for (let l = 0; l < output.links.length; l++) {
                let targetNode = node.getOutputNodes(o)[l];

                if (output.type === "@EXEC") {
                    execCode += "  node_" + targetNode.id + "_exec();\n";
                } else {

                    /* if (output.linkType === "method") {
                         generateMethod("event", output.methodData.name, node, output, targetNode, o, l);

                     } else*/
                    if (output.linkType === "object") {
                        code += "  node_" + targetNode.id + " = event." + output.name + "();\n";
                    } else if (output.linkType === "getter") {
                        fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                        code += "  node_" + node.id + "_output_" + o + " = event." + output.name + "();\n";
                    } else {
                        code += "  " + output.type + " output_" + o + "_" + l + " = event." + output.name + "();\n";
                    }
                }

                // if (targetInput.linkType === "trigger" || targetInput.linkType === "setter") {
                //     generateSetterMethodCall(targetInput.name, targetNode, targetInput, output.links[l].target_slot, "node_" + node.id, "node_" + node.id + "_output_" + o);
                // }

                // if (output.linkType === "this") {
                //     code += node.type + " output_" + o + "_" + l + " = event;\n";
                //
                // } else if (output.linkType === "method") {
                //     generateMethodCall("event", output.methodData.name, node, output, node.getOutputNodes(o)[l], o, l);
                //
                // } else if (output.linkType === "object") {
                //     code += "node_" + node.getOutputNodes(o)[l].id + " = event." + output.name + "();\n";
                // } else {
                //     code += output.type + " output_" + o + "_" + l + " = event." + output.name + "();\n";
                // }
            }
        }
    }

    code += execCode;
    code += "}\n";

    eventListenerMethods.push(code);
}


// function generateMethod(refName, methodName, objectNode, output, methodNode, outputIndex, linkIndex) {
//     let code = "private " + methodNode.methodData.return_type + " node_" + methodNode.id + "_out_" + outputIndex + "() {\n" +
//         "" +
//         "}\n";
//     //TODO
// }

function generateSetterMethodCall(methodName, targetNode, targetInput, inputIndex, obj, param) {
    let code = "// SETTER for " + targetNode.title + "#" + methodName + "\n" +
        "private void node_" + targetNode.id + "_in_" + inputIndex + "() {\n" +
        "  " + obj + "." + methodName + "(" + param + ");\n" +
        "}\n"

    methodCalls.push(code);
    return "node_" + targetNode.id + "_in_" + inputIndex;
}

function generateCodeForObjectClassNode(n, node) {
    let field = "private " + node.type + " node_" + node.id + ";";

    let code = "// CLASS EXECUTION for " + node.title + "\n" +
        "private void node_" + node.id + "_exec() {\n";
    let execCode = "";
    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.linkType === "method") continue;

            if (output.type === "@EXEC") {
                for (let l = 0; l < output.links.length; l++) {
                    let targetNode = node.getOutputNodes(o)[l];
                    execCode += "  node_" + targetNode.id + "_exec();\n";
                }
            } else {
                fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                if(output.linkType==="this"){
                    code += "  node_" + node.id + "_output_" + o + " = node_" + node.id +";\n";
                }else {
                    code += "  node_" + node.id + "_output_" + o + " = node_" + node.id + "." + output.name + "();\n";
                }
            }
        }
    }

    for (let i = 0; i < node.inputs.length; i++) {
        let input = node.inputs[i];
        if (!input) continue;
        if (!input.link) continue;
        let linkInfo = graph.links[input.link];
        if (!linkInfo) continue;
        // let sourceNode = node.getInputNode(i);
        // if(!sourceNode)continue;
        // let sourceOutput = sourceNode.outputs[input.link];

        // let sourceNode = graph.getNodeById(input.link.origin_id);
        // let sourceOutput = sourceNode.outputs[input.link.origin_slot];

        if (input.linkType === "trigger" || input.linkType === "setter") {
            let m = generateSetterMethodCall(input.name, node, input, i, "node_" + node.id, input.linkType === "setter" ? "node_" + linkInfo.origin_id + "_output_" + linkInfo.origin_slot : "");
            code += "  " + m + "();\n";
        }
    }

    code += execCode;
    code += "}\n";

    objectMethods.push(code);


    fields.push(field);
    return field;
}

function generateCodeForEnumClassNode(n, node) {
    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.linkType === "method") continue;

            fields.push("private " + output.type + " node_" + node.id + "_output_" + o + " = " + node.classData.name + "." + output.name + ";");
        }
    }
}

function generateCodeForMethodNode(n, node) {
    let code = "// METHOD EXECUTION for %obj#%method\n" +
        "private void node_" + node.id + "_exec() {\n";

    let execCode = "";
    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.name === "RETURN") {
                fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                code += "  node_" + node.id + "_output_" + o + " =";
                break;
            } else if (output.type === "@EXEC") {
                for (let l = 0; l < output.links.length; l++) {
                    let targetNode = node.getOutputNodes(o)[l];
                    execCode += "  node_" + targetNode.id + "_exec();\n";
                }
            }
        }
    }

    let params = [];
    for (let i = 0; i < node.inputs.length; i++) {
        let input = node.inputs[i];
        if (!input) continue;
        // if (!input.link) continue;
        let linkInfo = input.link ? graph.links[input.link] : null;
        if (!linkInfo) {
            if (i === 1) {// REF
                console.warn("Missing method reference for " + node.name);
                return;// can't continue -> no object to execute the method on
            }
        }
        let sourceNode = linkInfo ? graph.getNodeById(linkInfo.origin_id) : null;
        let sourceOutput = sourceNode ? sourceNode.outputs[linkInfo.origin_slot] : null;

        if (i === 0) continue;// EXEC
        if (i === 1) {// param opening bracket
            code = code.replace("%obj", sourceNode.title).replace("%method", sourceOutput.name);
            if (sourceNode.classType === "enum") {
                code += " " + sourceNode.classData.name + "." + sourceOutput.name + "(";
            } else {
                code += " node_" + linkInfo.origin_id + "." + sourceOutput.name + "(";
            }
            continue;
        }


        if (!linkInfo || !sourceNode) {
            params.push("null");
        } else {// append param
            params.push("node_" + linkInfo.origin_id + "_output_" + linkInfo.origin_slot);
        }
    }

    code += params.join(",");
    code += ");\n";

    code += execCode;

    code += "}\n";

    methodCalls.push(code);
}

function generateCodeForNativeNode(n, node) {
    if (!node.getOutputCode) return;

    let inputVars = [];
    if(node.inputs) {
        for (let i = 0; i < node.inputs.length; i++) {
            let input = node.inputs[i];
            if (!input) continue;
            if (!input.link) continue;
            let linkInfo = graph.links[input.link];
            if (!linkInfo) continue;
            if(input.type==="@EXEC")continue;

            inputVars.push("node_" + linkInfo.origin_id + "_output_" + linkInfo.origin_slot);
        }
    }

    let outputCode = node.getOutputCode(inputVars);

    if ((!node.inputs||node.inputs.length === 0) && node.outputs&&node.outputs.length > 0) {
        if (!node.getNativeType) return;

        let nativeType = node.getNativeType();


        if (!Array.isArray(nativeType) && !Array.isArray(outputCode)) {
            fields.push("private " + nativeType + " node_" + node.id + "_output_0 = " + outputCode + ";");
        } else if (Array.isArray(nativeType) && Array.isArray(outputCode)) {
            if (nativeType.length !== outputCode.length) {
                console.error("Array length mismatch for native node " + node.name);
                return;
            }
            for (let i = 0; i < nativeType.length; i++) {
                fields.push("private " + nativeType[i] + " node_" + node.id + "_output_" + i + " = " + outputCode[i] + ";");
            }
        } else {
            console.error("Either the type or the output of native node " + node.name + " is not an array while the other is");
        }
    } else if ((!node.outputs||node.outputs.length === 0) && node.inputs.length > 0) {
        nativeCalls.push("private void node_" + node.id + "_exec() {\n" +
            outputCode + "\n" +
            "}\n");
    } else if (node.outputs&&node.outputs.length > 0 && node.inputs&&node.inputs.length > 0) {
        if (!node.getNativeType) return;

        let nativeType = node.getNativeType();

        if (!Array.isArray(nativeType) && !Array.isArray(outputCode)) {
            fields.push("private " + nativeType + " node_" + node.id + "_output_0;");
            nativeCalls.push("private void node_" + node.id + "_exec() {\n" +
                "node_" + node.id + "_output_0 = " + outputCode + "\n" +
                "}\n");
        } else if (Array.isArray(nativeType) && Array.isArray(outputCode)) {
            if (nativeType.length !== outputCode.length) {
                console.error("Array length mismatch for native node " + node.name);
                return;
            }
            for (let i = 0; i < nativeType.length; i++) {
                fields.push("private " + nativeType[i] + " node_" + node.id + "_output_" + i + ";");
                nativeCalls.push("private void node_" + node.id + "_exec() {\n" +
                    "node_" + node.id + "_output_" + i + " = " + outputCode[i] + "\n" +
                    "}\n");
            }
        } else {
            console.error("Either the type or the output of native node " + node.name + " is not an array while the other is");
        }
    }
}

module.exports = {
    generateClassCode: generateClassCode
}