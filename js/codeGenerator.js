const fs = require("fs");
const {LiteGraph} = require("../node_modules/litegraph.js/build/litegraph");
const Colors = require("./colors");

const classesByName = [];

const fields = [];
const eventListenerMethods = [];
const objectMethods = [];
const enumMethods = [];
const generatedMethods = [];
const methodCalls = [];
const nativeCalls = [];

function generateClassCode(graph,projectInfo) {
    console.log(graph)
    for (let i = 0; i < graph._nodes.length; i++) {
        if (graph._nodes[i].nodeType === "BukkitClassNode") {
            if (graph._nodes[i].classType === "event") {
                generateCodeForEventClassNode(graph,i, graph._nodes[i]);
            }
            if (graph._nodes[i].classType === "object") {
                generateCodeForObjectClassNode(graph,i, graph._nodes[i]);
            }
            if (graph._nodes[i].classType === "enum") {
                generateCodeForEnumClassNode(graph,i, graph._nodes[i]);
            }
        } else if (graph._nodes[i].nodeType === "BukkitMethodNode") {
            generateCodeForMethodNode(graph,i, graph._nodes[i]);
        } else {
            if (graph._nodes[i].classType === "native") {
                generateCodeForNativeNode(graph,i, graph._nodes[i]);
            }
        }
    }


    let classCode = "" +
        "package "+projectInfo.package+";\n" +
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

    return classCode;
}

function generateCodeForEventClassNode(graph,n, node) {
    let code = "" +
        "@org.bukkit.event.EventHandler\n" +
        "public void on(" + node.type + " event) {\n";

    fields.push("private " + node.type + " node_" + node.id + ";");
    code += "  node_" + node.id + " = event;\n";

    // temporary variable so we can append the execution AFTER assigning variables
    let execCode = "";

    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        console.log(output)
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {

            for (let l = 0; l < output.links.length; l++) {
                let linkInfo = graph.links[output.links[l]];
                console.log(graph.links)
                console.log(linkInfo)
                if(!linkInfo)continue;

                if (output.type === "@EXEC") {
                    execCode += "  node_" + linkInfo.target_id + "_exec();\n";
                } else {

                    /* if (output.linkType === "method") {
                         generateMethod("event", output.methodData.name, node, output, targetNode, o, l);

                     } else*/
                    if (output.linkType === "object") {
                        code += "  node_" + linkInfo.target_id+ " = event." + output.name.split("(")[0] + "();\n";
                    } else if (output.linkType === "getter") {
                        fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                        code += "  node_" + node.id + "_output_" + o + " = event." + output.name.split("(")[0] + "();\n";
                    } else {
                        code += "  " + output.type + " output_" + o + "_" + l + " = event." + output.name.split("(")[0] + "();\n";
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

    for (let i = 0; i < node.inputs.length; i++) {
        let input = node.inputs[i];
        if (!input) continue;
        if (!input.link) continue;
        let linkInfo = graph.links[input.link];
        if (!linkInfo) continue;

        if (input.linkType === "trigger" || input.linkType === "setter") {
            let m = generateSetterMethodCall(input.name, node, input, i, "node_" + node.id, input.linkType === "setter" ? "node_" + linkInfo.origin_id + "_output_" + linkInfo.origin_slot : "");
            code += "  " + m + "();\n";
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

function generateCodeForObjectClassNode(graph,n, node) {
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
                    let linkInfo = graph.links[output.links[l]];
                    if(!linkInfo)continue;
                    execCode += "  node_" + linkInfo.target_id + "_exec();\n";
                }
            } else {
                fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                if(output.linkType==="this"){
                    code += "  node_" + node.id + "_output_" + o + " = node_" + node.id +";\n";
                }else {
                    code += "  node_" + node.id + "_output_" + o + " = node_" + node.id + "." + output.name.split("(")[0] + "();\n";
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

    if (node.classData.name === "org.bukkit.plugin.java.JavaPlugin") {
        code += "  node_" + node.id + " = this;\n";
    }

    code += execCode;
    code += "}\n";

    objectMethods.push(code);


    fields.push(field);
    return field;
}

function generateCodeForEnumClassNode(graph,n, node) {
    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.linkType === "method") continue;

            fields.push("private " + output.type + " node_" + node.id + "_output_" + o + " = " + node.classData.name + "." + output.name.split("(")[0] + ";");
        }
    }
}

function generateCodeForMethodNode(graph,n, node) {
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
                    let linkInfo = graph.links[output.links[l]];
                    if(!linkInfo)continue;
                    execCode += "  node_" + linkInfo.target_id+ "_exec();\n";
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
            code = code.replace("%obj", sourceNode.title).replace("%method", sourceOutput.name.split("(")[0]);
            if (sourceNode.classType === "enum") {
                code += " " + sourceNode.classData.name + "." + sourceOutput.name.split("(")[0] + "(";
            } else {
                code += " node_" + linkInfo.origin_id + "." + sourceOutput.name.split("(")[0] + "(";
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

function generateCodeForNativeNode(graph,n, node) {
    console.log(node)
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
        let outputIndex=node.getOutputIndex();


        if (!Array.isArray(nativeType) && !Array.isArray(outputCode)) {
            if(!outputIndex)outputIndex=0;
            fields.push("private " + nativeType + " node_" + node.id + "_output_"+outputIndex+" = " + outputCode + ";");
        } else if (Array.isArray(nativeType) && Array.isArray(outputCode)) {
            if (nativeType.length !== outputCode.length) {
                console.error("Array length mismatch for native node " + node.name);
                return;
            }
            for (let i = 0; i < nativeType.length; i++) {
                fields.push("private " + nativeType[i] + " node_" + node.id + "_output_" + (outputIndex[i]||0) + " = " + outputCode[i] + ";");
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
        let outputIndex=node.getOutputIndex();

        if (!Array.isArray(nativeType) && !Array.isArray(outputCode)) {
            if(!outputIndex)outputIndex=0;
            fields.push("private " + nativeType + " node_" + node.id + "_output_"+outputIndex+";");
            nativeCalls.push("private void node_" + node.id + "_exec() {\n" +
                "node_" + node.id + "_output_"+outputIndex+" = " + outputCode + "\n" +
                "}\n");
        } else if (Array.isArray(nativeType) && Array.isArray(outputCode)) {
            if (nativeType.length !== outputCode.length) {
                console.error("Array length mismatch for native node " + node.name);
                return;
            }
            for (let i = 0; i < nativeType.length; i++) {
                fields.push("private " + nativeType[i] + " node_" + node.id + "_output_" + (outputIndex[i]||0) + ";");
                nativeCalls.push("private void node_" + node.id + "_exec() {\n" +
                    "node_" + node.id + "_output_" + (outputIndex[i]||0) + " = " + outputCode[i] + "\n" +
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