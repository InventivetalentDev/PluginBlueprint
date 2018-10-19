const fs = require("fs");
const {LiteGraph} = require("litegraph.js");
const Colors = require("./colors");

const classesByName = [];

const fields = [];
const eventListenerMethods = [];
const objectMethods = [];
const generatedMethods = [];
const methodCalls = [];

function generateClassCode(graph) {
    for (let i = 0; i < graph._nodes.length; i++) {
        if (graph._nodes[i].constructor.name === "BukkitClassNode") {
            if (graph._nodes[i].classType === "event") {
                generateCodeForEventClassNode(i, graph._nodes[i]);
            }
            if (graph._nodes[i].classType === "object") {
                generateCodeForObjectClassNode(i, graph._nodes[i]);
            }
        }
        if (graph._nodes[i].constructor.name === "BukkitMethodNode") {
            generateCodeForMethodNode(i, graph._nodes[i]);
        }
    }


    let classCode = "" +
        "package org.inventivetalent.pluginbluprint.generated;\n" +//TODO: custom package name
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
        generatedMethods.join("\n") +
        "\n\n" +
        methodCalls.join("\n") +
        "\n" +
        "}\n";

    console.log(classCode);

    // Reset
    fields.splice(0, fields.length);
    eventListenerMethods.splice(0, eventListenerMethods.length);
    generatedMethods.splice(0, generatedMethods.length);
    objectMethods.splice(0, objectMethods.length);
    methodCalls.splice(0, methodCalls.length);
}

function generateCodeForEventClassNode(n, node) {
    let code = "" +
        "@org.bukkit.event.EventHandler\n" +
        "public void on(" + node.type + " event) {\n";

    fields.push("private " + node.type + " node_" + node.id + ";");
    code += "  node_" + node.id + " = event;\n";

    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.name === "EXEC") continue;

            for (let l = 0; l < output.links.length; l++) {
                let targetNode = node.getOutputNodes(o)[l];

                /* if (output.linkType === "method") {
                     generateMethod("event", output.methodData.name, node, output, targetNode, o, l);

                 } else*/
                if (output.linkType === "object") {
                    code += "  node_" + node.getOutputNodes(o)[l].id + " = event." + output.name + "();\n";
                } else if (output.linkType === "getter") {
                    fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
                    code += "  node_" + node.id + "_output_" + o + " = event." + output.name + "();\n";
                } else {
                    code += "  " + output.type + " output_" + o + "_" + l + " = event." + output.name + "();\n";
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
    let code = "// SETTER for " + targetNode.title + "#" + methodName +"\n"+
        "private void node_" + targetNode.id + "_in_" + inputIndex + "() {\n" +
        "  " + obj + "." + methodName + "(" + param + ");\n" +
        "}\n"

    methodCalls.push(code);
    return "node_" + targetNode.id + "_in_" + inputIndex;
}

function generateCodeForObjectClassNode(n, node) {
    let field = "private " + node.type + " node_" + node.id + ";";

    let code = "// CLASS EXECUTION for " + node.title +"\n"+
        "private void node_" + node.id + "_exec() {\n";
    for (let o = 0; o < node.outputs.length; o++) {
        let output = node.outputs[o];
        if (!output) continue;
        if (!output.links) continue;
        if (output.links.length > 0) {
            if (output.name === "EXEC") continue;
            if (output.linkType === "method") continue;

            fields.push("private " + output.type + " node_" + node.id + "_output_" + o + ";");
            code += "  node_" + node.id + "_output_" + o + " = node_" + node.id + "." + output.name + "();\n";
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


    code += "}\n";

    objectMethods.push(code);


    fields.push(field);
    return field;
}

function generateCodeForMethodNode(n, node) {
    let code = "// METHOD EXECUTION for %obj#%method\n" +
        "private void node_" + node.id + "_exec() {\n";

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
        if (i === 1) {
            code = code.replace("%obj", sourceNode.title).replace("%method", sourceOutput.name);
            code += "  node_" + linkInfo.origin_id + "." + sourceOutput.name + "(";
            continue;
        }


        if (!linkInfo || !sourceNode) {
            params.push("null");
        } else {
            params.push("node_" + linkInfo.origin_id + "_output_" + linkInfo.origin_slot);
        }
    }

    code += params.join(",");
    code += ");\n";

    code += "}\n";

    methodCalls.push(code);
}


module.exports = {
    generateClassCode: generateClassCode
}