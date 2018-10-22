const fs = require("fs");
const path = require("path");
const {LiteGraph} = require("../node_modules/litegraph.js/build/litegraph");
const Colors = require("./colors");
const nativeNodes = require("./nativeNodes");

const classesByName = {};

const eventClasses = [];
const objectClasses = [];
const enumClasses = [];

const methods = [];

const canvasMenuData = {};


function onEventAdd(node, options, e, prevMenu) {
    let entries = [];
    let existingCategories = [];
    for (let i = 0; i < eventClasses.length; i++) {
        if(!eventClasses[i].startsWith("org.bukkit"))continue;
        let v = eventClasses[i].substr("org.".length).split(".");
        v.pop();
        let v1 = v.join(".");
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: v.length >= 2})
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu});

    function inner_clicked(v, option, e) {
        var values = [];
        for (let i = 0; i < eventClasses.length; i++) {
            if(!eventClasses[i].startsWith("org.bukkit"))continue;
            let v0 = eventClasses[i].substr("org.".length).split(".");
            v0.pop();
            let v1 = v0.join(".");
            if (v.value === v1) {
                let v2 = eventClasses[i].substr("org.".length).split(".");
                values.push({content: v2[v2.length - 1], value: eventClasses[i]});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitClassNode(v.value, "event");
        var node = LiteGraph.createNode(nodeName);
        if (node) {
            node.pos = canvas.convertEventToCanvas(first_event);
            canvas.graph.add(node);
        }
    }
}

function onObjectAdd(node, options, e, prevMenu) {
    let entries = [];
    let existingCategories = [];
    for (let i = 0; i < objectClasses.length; i++) {
        if(!objectClasses[i].startsWith("org.bukkit"))continue;
        let v = objectClasses[i].substr("org.".length).split(".");
        v.pop();
        let v1 = v.join(".");
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: v.length >= 2})
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu});

    function inner_clicked(v, option, e) {
        var values = [];
        for (let i = 0; i < objectClasses.length; i++) {
            if(!objectClasses[i].startsWith("org.bukkit"))continue;
            let v0 = objectClasses[i].substr("org.".length).split(".");
            v0.pop();
            let v1 = v0.join(".");
            if (v.value === v1) {
                let v2 = objectClasses[i].substr("org.".length).split(".");
                values.push({content: v2[v2.length - 1], value: objectClasses[i]});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitClassNode(v.value, "object");
        var node = LiteGraph.createNode(nodeName);
        if (node) {
            node.pos = canvas.convertEventToCanvas(first_event);
            canvas.graph.add(node);
        }
    }
}

function onMethodAdd(node, options, e, prevMenu) {
    let entries = [];
    let existingCategories = [];
    for (let i = 0; i < methods.length; i++) {
        if(!methods[i].startsWith("org.bukkit"))continue;
        let v = methods[i].substr("org.".length).split(".");
        v.pop();
        let v1 = v.join(".");
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: true})
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu});
    let menu1;

    function inner_clicked(v, option, e) {
        var values = [];
        let existingCategories = [];
        for (let i = 0; i < methods.length; i++) {
            if(!methods[i].startsWith("org.bukkit"))continue;
            let split = methods[i].substr("org.".length).split(".");
            let classAndMethod = split[split.length - 1];
            split.pop();
            if (v.value === split.join(".")) {
                let simpleName = classAndMethod.split("#")[0];
                if (existingCategories.indexOf(simpleName) === -1) {
                    values.push({content: simpleName, value: simpleName, has_submenu: true});
                    existingCategories.push(simpleName)
                }
            }
        }

        menu1 = new LiteGraph.ContextMenu(values, {event: e, callback: inner2_clicked, parentMenu: menu});
        return false;
    }

    function inner2_clicked(v, option, e) {
        var values = [];
        let existingCategories = [];
        for (let i = 0; i < methods.length; i++) {
            if(!methods[i].startsWith("org.bukkit"))continue;
            let split0 = methods[i].substr("org.".length).split(".");
            let split1 = split0[split0.length - 1].split("#");
            let clazz = split1[0];
            let method = split1[1];
            if (v.value === clazz) {
                if (existingCategories.indexOf(method) === -1) {
                    values.push({content: method, value: methods[i], has_submenu: false});
                    existingCategories.push(method);
                }
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu1});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitMethodNode(v.value, "method");
        console.log(nodeName)
        var node = LiteGraph.createNode(nodeName);
        console.log(node)
        if (node) {
            node.pos = canvas.convertEventToCanvas(first_event);
            canvas.graph.add(node);
        }
    }
}

function init() {
    return new Promise(((resolve, reject) => {

        // Clear default node types
        // LiteGraph.registered_node_types = {};
        // LiteGraph.Nodes = {};

        console.log("Registering " + nativeNodes.length + " native nodes...");
        for (let n = 0; n < nativeNodes.length; n++) {
            let nativeNode = nativeNodes[n];
            LiteGraph.registerNodeType("native/" + nativeNode.name, nativeNode);
        }

        LGraphCanvas.prototype.getMenuOptions = function () {
            return [
                {content: "Add Node", has_submenu: true, callback: LGraphCanvas.onMenuAdd},
                {content: "Add Bukkit Event", has_submenu: true, callback: onEventAdd},
                {content: "Add Bukkit Object", has_submenu: true, callback: onObjectAdd},
                {content: "Add Bukkit Method", has_submenu: true, callback: onMethodAdd},
                {content: "Add Group", callback: LGraphCanvas.onGroupAdd}
            ]
        };


        LGraphCanvas.link_type_colors = Object.assign(LGraphCanvas.link_type_colors, {"@EXEC": "red", "boolean": "green", "java.lang.String": "blue"})


        fs.readFile(path.join(__dirname, "../data/bukkitClasses.json"), "utf-8", (err, data) => {
            if (err) {
                console.error("Failed to read bukkit classes data file!")
                reject();
                return;
            }
            data = JSON.parse(data);

            for (let i = 0; i < data.classes.length; i++) {
                classesByName[data.classes[i].name] = data.classes[i];

                let cl = data.classes[i];

                if (/*(!cl.isAbstract || cl.isInterface) &&*/ !cl.isEnum) {
                    if (cl.name.indexOf("Event") !== -1) {
                        eventClasses.push(cl.name);
                    } else {
                        objectClasses.push(cl.name);
                    }
                } else if (cl.isEnum) {
                    enumClasses.push(cl.name);
                }

                for (let j = 0; j < data.classes[i].methods.length; j++) {
                    let methodName = data.classes[i].name + "#" + data.classes[i].methods[j].name;
                    let params = [];
                    for (let k = 0; k < data.classes[i].methods[j].parameters.length; k++) {
                        params.push(data.classes[i].methods[j].parameters[k].name);
                    }
                    methods.push(methodName + "(" + params.join(",") + ")");
                }
            }


            console.log("Loaded " + data.classes.length + " Bukkit classes");

            fs.readFile(path.join(__dirname, "../data/javaClasses.json"), "utf-8", (err, data) => {
                if (err) {
                    console.error("Failed to read java classes data file!")
                    reject();
                    return;
                }
                data = JSON.parse(data);

                for (let i = 0; i < data.classes.length; i++) {
                    classesByName[data.classes[i].name] = data.classes[i];

                    let cl = data.classes[i];

                    if (/*(!cl.isAbstract || cl.isInterface) &&*/ !cl.isEnum) {
                            objectClasses.push(cl.name);
                    } else if (cl.isEnum) {
                        enumClasses.push(cl.name);
                    }
                    //
                    // for (let j = 0; j < data.classes[i].methods.length; j++) {
                    //     let methodName = data.classes[i].name + "#" + data.classes[i].methods[j].name;
                    //     let params = [];
                    //     for (let k = 0; k < data.classes[i].methods[j].parameters.length; k++) {
                    //         params.push(data.classes[i].methods[j].parameters[k].name);
                    //     }
                    //     methods.push(methodName + "(" + params.join(",") + ")");
                    // }
                }


                console.log("Loaded " + data.classes.length + " Java classes");

                resolve();
            });
        });

    }))
}

function getOrCreateBukkitClassNode(className) {

    if (!classesByName.hasOwnProperty(className)) {
        console.warn("Class " + className + " does not exist or isn't loaded");
        return null;
    }
    let classData = classesByName[className];
    let classNameSplit = classData.name.split(".");
    let simpleClassName = classNameSplit[classNameSplit.length - 1];
    // let packageSplit = className.substr("org.".length).split(".");
    // if (packageSplit.length > 2 && packageSplit[packageSplit.length - 2].charAt(0) === packageSplit[packageSplit.length - 2].charAt(0).toUpperCase()) {
    //     simpleClassName = packageSplit[packageSplit.length - 2] + "." + packageSplit[packageSplit.length - 1];
    //     let temp = packageSplit[packageSplit.length - 2] + "." + packageSplit[packageSplit.length - 1];
    //     packageSplit.pop();
    //     packageSplit[packageSplit.length - 1] = temp;
    //
    // }
    let categoryName = classData.name;

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitClassNode() {
        addClassIO(this, className);
        this.nodeType = "BukkitClassNode";
        if (eventClasses.indexOf(className) !== -1) {
            this.classType = "event";
        }
        if (objectClasses.indexOf(className) !== -1) {
            this.classType = "object";
        }
        if (enumClasses.indexOf(className) !== -1) {
            this.classType = "enum";
        }

        this.classData = classData;
    }

    BukkitClassNode.title = simpleClassName;

    if (eventClasses.indexOf(className) !== -1) {
        BukkitClassNode.prototype.color = Colors.EVENT;
    }
    if (objectClasses.indexOf(className) !== -1) {
        BukkitClassNode.prototype.color = Colors.OBJECT;
    }


    BukkitClassNode.prototype.onOutputDblClick = function (i, e) {
        handleSlotDoubleClick(this, i, e);
    };
    BukkitClassNode.prototype.onDblClick = function () {
        console.log(this);
    };

    LiteGraph.registerNodeType(categoryName, BukkitClassNode);

    return categoryName;
}

function addClassIO(node, className, isChildCall) {
    let classData = classesByName[className];

    if (!isChildCall) {
        if (eventClasses.indexOf(className) === -1 && enumClasses.indexOf(className) === -1) {
            node.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
        }
        if( enumClasses.indexOf(className) === -1) {
            node.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
        }
    }

    if (!isChildCall && objectClasses.indexOf(className) !== -1) {
        node.addInput("REF", className, {linkType: "ref", shape: LiteGraph.BOX_SHAPE, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON})
    }
    if (!isChildCall && !classData.isInterface) {
        node.addOutput("THIS", className, {linkType: "this", shape: LiteGraph.BOX_SHAPE, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON})
    }

    // for (let f = 0; f < classData.fields.length; f++) {
    //     let field = classData.fields[f];
    //     if (field.type === "boolean") {
    //         node.addOutput(field.name, field.type+field.type_dimension, {linkType: "getter", fieldData: field, colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
    //     } else if (field.type === "number" || field.type === "int" || field.type === "double" || field.type === "float" || field.type === "short"||field.type==="long"||field.type==="byte") {
    //         node.addOutput(field.name, field.type+field.type_dimension, {linkType: "getter", fieldData: field, colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
    //     } else if (field.type === "string" || field.type === "java.lang.String") {
    //         node.addOutput(field.name, field.type+field.type_dimension, {linkType: "getter", fieldData: field, colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
    //     } else if (objectClasses.indexOf(field.type) !== -1) {
    //         node.addOutput(field.name, field.type+field.type_dimension, {linkType: "object", fieldData: field, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON});
    //     }else if(enumClasses.indexOf(field.type)!==-1){
    //         node.addOutput(field.name, field.type+field.type_dimension, {linkType: "enum", fieldData: field, colorOff: Colors.ENUM_OFF, colorOn: Colors.ENUM_ON});
    //     } else {
    //         // node.addOutput(field.name, field.type);
    //         // node.addOutput(field.name, classData.name+"#"+methodSignature, {linkType: "method", fieldData: field, shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});
    //     }
    //     //TODO: setters
    // }

    for (let f = 0; f < classData.enumConstants.length; f++) {
        let en = classData.enumConstants[f];
        node.addOutput(en, classData.name, {linkType: "enum", enumData: en, colorOff: Colors.ENUM_OFF, colorOn: Colors.ENUM_ON});
    }
    
    for (let m = 0; m < classData.methods.length; m++) {
        let method = classData.methods[m];


        let params = [];
        for(let i=0;i<method.parameters.length;i++){
            params.push(method.parameters[i].name);
        }
        let methodSignature = method.name + "(" + params.join(",") + ")";

        let found = false;
        if (node.inputs) {
            for (let s = 0; s < node.inputs.length; s++) {
                if (node.inputs[s].name === method.name||node.inputs[s].name===methodSignature) {
                    found = true;
                    break;
                }
            }
        }
        if (found) continue;
        if (node.outputs) {
            for (let s = 0; s < node.outputs.length; s++) {
                if (node.outputs[s].name === method.name||node.outputs[s].name===methodSignature) {
                    found = true;
                    break;
                }
            }
        }
        if (found) continue;


        /*if (method.name.startsWith("get")) {
            node.addOutput(method.name.substr(3), method.return_type);
        } else if (method.name.startsWith("set")) {
            node.addInput(method.name.substr(3), method.return_type);
        } else*/
        if (method.return_type === "void") {
            if (method.parameters.length === 0) {
                node.addInput(method.name, LiteGraph.ACTION, {linkType: "trigger", methodData: method});
            } else if (method.parameters.length === 1) {
                if (method.parameters[0].type === "boolean") {
                    node.addInput(method.name, method.parameters[0].type+method.parameters[0].type_dimension, {linkType: "setter", methodData: method, colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
                } else if (method.parameters[0].type === "number" || method.parameters[0].type === "int" || method.parameters[0].type === "double" || method.parameters[0].type === "float" || method.parameters[0].type === "short"||method.parameters[0].type==="long"||method.parameters[0].type==="byte") {
                    node.addInput(method.name, method.parameters[0].type+method.parameters[0].type_dimension, {linkType: "setter", methodData: method, colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
                } else if (method.parameters[0].type === "string" || method.parameters[0].type === "java.lang.String") {
                    node.addInput(method.name, method.parameters[0].type+method.parameters[0].type_dimension, {linkType: "setter", methodData: method, colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
                } /*else if (objectClasses.indexOf(method.parameters[0].type) !== -1) {
                    node.addInput(method.name, method.parameters[0].type+method.parameters[0].type_dimension, {shape: LiteGraph.BOX_SHAPE, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON});
                }*/ else {
                    // node.addInput(method.name, method.parameters[0].type);
                    node.addOutput( methodSignature, classData.name+"#"+methodSignature, {linkType: "method", methodData: method, shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});
                }
            } else {
                node.addOutput(methodSignature, classData.name+"#"+methodSignature, {linkType: "method", methodData: method, shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});
            }
        } else if (method.parameters.length === 0) {
            if (method.return_type === "boolean") {
                node.addOutput(method.name, method.return_type+method.return_type_dimension, {linkType: "getter", methodData: method, colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
            } else if (method.return_type === "number" || method.return_type === "int" || method.return_type === "double" || method.return_type === "float" || method.return_type === "short"||method.return_type==="long"||method.return_type==="byte") {
                node.addOutput(method.name, method.return_type+method.return_type_dimension, {linkType: "getter", methodData: method, colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
            } else if (method.return_type === "string" || method.return_type === "java.lang.String") {
                node.addOutput(method.name, method.return_type+method.return_type_dimension, {linkType: "getter", methodData: method, colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
            } else if (objectClasses.indexOf(method.return_type) !== -1) {
                node.addOutput(method.name, method.return_type+method.return_type_dimension, {linkType: "object", methodData: method, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON});
            }else if(enumClasses.indexOf(method.return_type)!==-1){
                node.addOutput(method.name, method.return_type+method.return_type_dimension, {linkType: "enum", methodData: method, colorOff: Colors.ENUM_OFF, colorOn: Colors.ENUM_ON});
            } else {
                // node.addOutput(method.name, method.return_type);
                node.addOutput(method.name, classData.name+"#"+methodSignature, {linkType: "method", methodData: method, shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});
            }
        } else {
            node.addOutput(methodSignature,classData.name+"#"+ methodSignature, {linkType: "method", methodData: method, shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});
        }
    }

    for (let i = 0; i < classData.interfaces.length; i++) {
        addClassIO(node, classData.interfaces[i], true);
    }
    if (classData.superclass && classData.superclass.length > 0 && classData.superclass !== "java.lang.Object" && classData.superclass !== "java.lang.Enum") {
        console.log(classData.superclass)
        addClassIO(node, classData.superclass, true);
    }
}

function getOrCreateBukkitMethodNode(classMethodName) {
    let split = classMethodName.split("#");
    let className = split[0];
    let methodNameSplit = split[1].split("(");
    let methodName = methodNameSplit[0];
    // let methodParamString = methodNameSplit[1].substring(0, methodNameSplit[1].length - 1);

    if (!classesByName.hasOwnProperty(className)) {
        console.warn("Class " + className + " does not exist or isn't loaded");
        return null;
    }
    let classData = classesByName[className];
    let classNameSplit = classData.name.split(".");
    let simpleClassName = classNameSplit[classNameSplit.length - 1];

    let methodData;
    for (let i = 0; i < classData.methods.length; i++) {
        if (classData.methods[i].name === methodName) {
            let params = [];
            for(let j=0;j<classData.methods[i].parameters.length;j++){
                params.push(classData.methods[i].parameters[j].name);
            }
            let methodSignature = classData.methods[i].name + "(" + params.join(",") + ")";
            if(methodSignature===split[1]) {
                methodData = classData.methods[i];
                break;
            }
        }
    }
    if (!methodData) {
        console.warn("Missing method data for " + classMethodName + " (" + methodName + " in " + className + ")");
        return null;
    }

    let categoryName = className + "#" + split[1];

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitMethodNode() {
        addMethodIO(this, classData, methodData);
        this.nodeType = "BukkitMethodNode";
        this.methodData = methodData;
    }

    BukkitMethodNode.title = simpleClassName + "#" + methodName;

    BukkitMethodNode.prototype.color = Colors.FUNCTION;


    BukkitMethodNode.prototype.onOutputDblClick = function (i, e) {
        handleSlotDoubleClick(this, i, e);
    };
    BukkitMethodNode.prototype.onDblClick = function () {
        console.log(this);
    };

    LiteGraph.registerNodeType(categoryName, BukkitMethodNode);

    return categoryName;
}

function addMethodIO(node, classData, methodData) {

    let params = [];
    for(let i=0;i<methodData.parameters.length;i++){
        params.push(methodData.parameters[i].name);
    }
    let methodSignature = methodData.name + "(" + params.join(",") + ")";

    node.addInput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});
    node.addOutput("EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, colorOff: Colors.EXEC_OFF, colorOn: Colors.EXEC_ON});

    node.addInput("REF", classData.name + "#" +methodSignature, {shape: LiteGraph.BOX_SHAPE, colorOff: Colors.FUNCTION_OFF, colorOn: Colors.FUNCTION_ON});


    if (methodData.parameters.length === 0) {
        node.addInput(methodData.name, LiteGraph.ACTION);
    } else {
        for (let p = 0; p < methodData.parameters.length; p++) {
            let param = methodData.parameters[p];

            if (param.type === "boolean") {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param, colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
            } else if (param.type === "number" || param.type === "int" || param.type === "double" || param.type === "float" || param.type === "short" || param.type === "long") {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param, colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
            } else if (param.type === "string" || param.type === "java.lang.String") {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param, colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
            } else if (objectClasses.indexOf(param.type) !== -1) {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param, colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON});
            } else if (enumClasses.indexOf(param.type) !== -1) {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param, colorOff: Colors.ENUM_OFF, colorOn: Colors.ENUM_ON});
            } else {
                node.addInput(param.name, param.type+param.type_dimension, {paramData: param});
            }
        }
    }

    if (methodData.return_type === "void") {
        node.addOutput("RETURN", LiteGraph.EVENT);
    } else {
        if (methodData.return_type === "boolean") {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension, {colorOff: Colors.BOOLEAN_OFF, colorOn: Colors.BOOLEAN_ON});
        } else if (methodData.return_type === "number" || methodData.return_type === "int" || methodData.return_type === "double" || methodData.return_type === "float" || methodData.return_type === "short" || methodData.return_type === "long") {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension, {colorOff: Colors.NUMBER_OFF, colorOn: Colors.NUMBER_ON});
        } else if (methodData.return_type === "string" || methodData.return_type === "java.lang.String") {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension, {colorOff: Colors.STRING_OFF, colorOn: Colors.STRING_ON});
        } else if (objectClasses.indexOf(methodData.return_type) !== -1) {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension, {colorOff: Colors.OBJECT_OFF, colorOn: Colors.OBJECT_ON});
        } else if (enumClasses.indexOf(methodData.return_type) !== -1) {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension, {colorOff: Colors.ENUM_OFF, colorOn: Colors.ENUM_ON});
        } else {
            node.addOutput("RETURN", methodData.return_type+methodData.return_type_dimension);
        }
    }
}

function handleSlotDoubleClick(node, i, e) {
    console.log("onOutputDblClick");
    let slot = node.getOutputInfo(i);
    console.log(slot);

    let nodeName;
    if (slot.type.indexOf("#") !== -1) {
        nodeName = getOrCreateBukkitMethodNode(slot.type);
    } else if (slot.type.startsWith("org.bukkit") && classesByName.hasOwnProperty(slot.type)) {
        nodeName = getOrCreateBukkitClassNode(slot.type);
    }
    if (nodeName) {
        console.log(nodeName)
        var n = LiteGraph.createNode(nodeName);
        n.pos = [e.canvasX + 40, e.canvasY - 10];
        canvas.graph.add(n);

        node.connect(0, n, 0);// 0 = EXEC
        node.connect(i, n, 1);// 1 = REF
    }
}

module.exports = {
    init: init,
    getOrCreateBukkitClassNode: getOrCreateBukkitClassNode,
    getOrCreateBukkitMethodNode: getOrCreateBukkitMethodNode,
    getClassesByName: () => {
        return classesByName;
    },
    getMethods: () => {
        return methods;
    }
};