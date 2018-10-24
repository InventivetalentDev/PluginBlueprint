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

const inputOutputSorter = function (a, b) {
    var nameA = a.name.toUpperCase(); // ignore upper and lowercase
    var nameB = b.name.toUpperCase(); // ignore upper and lowercase


    if (nameA === "EXEC" || nameA === "REF" || nameA === "THIS") {
        return -1;
    }
    if (nameB === "EXEC" || nameB === "REF" || nameB === "THIS") {
        return 1;
    }

    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }

    // names must be equal
    return 0;
}

function onEventAdd(node, options, e, prevMenu) {
    let entries = [];
    let existingCategories = [];
    for (let i = 0; i < eventClasses.length; i++) {
        if (!eventClasses[i].startsWith("org.bukkit")) continue;
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
            if (!eventClasses[i].startsWith("org.bukkit")) continue;
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
        if (!objectClasses[i].startsWith("org.bukkit")) continue;
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
            if (!objectClasses[i].startsWith("org.bukkit")) continue;
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
        if (!methods[i].startsWith("org.bukkit")) continue;
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
            if (!methods[i].startsWith("org.bukkit")) continue;
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
            if (!methods[i].startsWith("org.bukkit")) continue;
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


        LGraphCanvas.link_type_colors = Object.assign(LGraphCanvas.link_type_colors, {"@EXEC": Colors.EXEC_OFF, "boolean": Colors.BOOLEAN_OFF, "java.lang.String": Colors.STRING_OFF, "byte": Colors.NUMBER_OFF, "char": Colors.NUMBER_OFF, "short": Colors.NUMBER_OFF, "int": Colors.NUMBER_OFF, "long": Colors.NUMBER_OFF, "float": Colors.NUMBER_OFF, "double": Colors.NUMBER_OFF})


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
                    for (let j = 0; j < data.classes[i].methods.length; j++) {
                        let methodName = data.classes[i].name + "#" + data.classes[i].methods[j].name;
                        let params = [];
                        for (let k = 0; k < data.classes[i].methods[j].parameters.length; k++) {
                            params.push(data.classes[i].methods[j].parameters[k].name);
                        }
                        methods.push(methodName + "(" + params.join(",") + ")");
                    }
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

        if (this.inputs)
            this.inputs.sort(inputOutputSorter);
        if (this.outputs)
            this.outputs.sort(inputOutputSorter);

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
        if (eventClasses.indexOf(className) === -1 && enumClasses.indexOf(className) === -1 && classData.name !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeInput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
        }
        if (enumClasses.indexOf(className) === -1 && classData.name !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeOutput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
        }
    }

    if (!isChildCall && objectClasses.indexOf(className) !== -1 && classData.name !== "org.bukkit.plugin.java.JavaPlugin") {
        addNodeInput(node, "REF", className, {linkType: "ref", shape: LiteGraph.BOX_SHAPE, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON})
    }
    if (!isChildCall && !classData.isEnum) {
        addNodeOutput(node, "THIS", className, {linkType: "this", shape: LiteGraph.BOX_SHAPE, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON})
    }

    if (classData.isEnum && classData.enumConstants.length > 0) {
        let i = addNodeOutput(node, classData.enumConstants[0], classData.name, {linkType: "enum", enumData: classData.enumConstants[0], color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON});
        node.addProperty("en", classData.enumConstants[0], "enum", {values: classData.enumConstants})
        node.onDrawBackground = function () {
            this.outputs[i].label = "[" + this.properties.en + "]";
        };
    }

    // for (let f = 0; f < classData.enumConstants.length; f++) {
    //     let en = classData.enumConstants[f];
    //     addNodeOutput(node, en, classData.name, {linkType: "enum", enumData: en, color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON});
    // }

    if (!classData.isInterface && !classData.isAbstract) {
        for (let c = 0; c < classData.constructors.length; c++) {
            let constructor = classData.constructors[c];
            for (let i = 0; i < constructor.parameters.length; i++) {
                let param = constructor.parameters[i];
                addNodeInput(node, param.name, param.type, {linkType: "constructorParam", constructorData: constructor})
            }
        }
    }


    for (let m = 0; m < classData.methods.length; m++) {
        let method = classData.methods[m];


        let params = [];
        for (let i = 0; i < method.parameters.length; i++) {
            params.push(method.parameters[i].name);
        }
        let methodSignature = method.name + "(" + params.join(",") + ")";


        let isLambda = checkLambda(classData, method);

        /*if (method.name.startsWith("get")) {
            addNodeOutput(node,method.name.substr(3), method.return_type);
        } else if (method.name.startsWith("set")) {
            addNodeInput(node,method.name.substr(3), method.return_type);
        } else*/
        if (method.return_type === "void") {
            addNodeOutput(node, methodSignature, classData.name + "#" + methodSignature, {linkType: isLambda ? "abstractMethod" : "method", methodData: method, shape: LiteGraph.BOX_SHAPE, color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF, color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON});
        } else if (method.parameters.length === 0) {
            if (method.return_type === "boolean") {
                addNodeOutput(node, method.name, method.return_type + method.return_type_dimension, {linkType: "getter", methodData: method, color_off: Colors.BOOLEAN_OFF, color_on: Colors.BOOLEAN_ON});
            } else if (method.return_type === "number" || method.return_type === "int" || method.return_type === "double" || method.return_type === "float" || method.return_type === "short" || method.return_type === "long" || method.return_type === "byte") {
                addNodeOutput(node, method.name, method.return_type + method.return_type_dimension, {linkType: "getter", methodData: method, color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON});
            } else if (method.return_type === "string" || method.return_type === "java.lang.String") {
                addNodeOutput(node, method.name, method.return_type + method.return_type_dimension, {linkType: "getter", methodData: method, color_off: Colors.STRING_OFF, color_on: Colors.STRING_ON});
            } else if (objectClasses.indexOf(method.return_type) !== -1) {
                addNodeOutput(node, method.name, method.return_type + method.return_type_dimension, {linkType: "object", methodData: method, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON});
            } else if (enumClasses.indexOf(method.return_type) !== -1) {
                addNodeOutput(node, method.name, method.return_type + method.return_type_dimension, {linkType: "enum", methodData: method, color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON});
            } else {
                // addNodeOutput(node,method.name, method.return_type);
                addNodeOutput(node, method.name, classData.name + "#" + methodSignature, {linkType: isLambda ? "abstractMethod" : "method", methodData: method, shape: LiteGraph.BOX_SHAPE, color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF, color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON});
            }
        } else {
            addNodeOutput(node, methodSignature, classData.name + "#" + methodSignature, {linkType: isLambda ? "abstractMethod" : "method", methodData: method, shape: LiteGraph.BOX_SHAPE, color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF, color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON});
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
            for (let j = 0; j < classData.methods[i].parameters.length; j++) {
                params.push(classData.methods[i].parameters[j].name);
            }
            let methodSignature = classData.methods[i].name + "(" + params.join(",") + ")";
            if (methodSignature === split[1]) {
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
        this.classData = classData;
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
    for (let i = 0; i < methodData.parameters.length; i++) {
        params.push(methodData.parameters[i].name);
    }
    let methodSignature = methodData.name + "(" + params.join(",") + ")";

    let isLambda = checkLambda(classData, methodData);

    if (!isLambda)
        addNodeInput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
    addNodeOutput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});

    addNodeInput(node, "REF", classData.name + "#" + methodSignature, {shape: LiteGraph.BOX_SHAPE, color_off: Colors.FUNCTION_OFF, color_on: Colors.FUNCTION_ON});


    if (isLambda && methodData.return_type === "void" || (classData.name === "org.bukkit.plugin.java.JavaPlugin" && (methodData.name === "onEnable" || methodData.name === "onDisable" || methodData.name === "onCommand" || methodData.name === "onTabComplete"))) {
        node.isAbstractMethod = true;
        node.color = Colors.ABSTRACT_FUNCTION_OFF;
        for (let p = 0; p < methodData.parameters.length; p++) {
            let param = methodData.parameters[p];
            let paramType = methodData.parameters[p].typeParameter ? "java.lang.Object" : param.type;

            addNodeOutput(node, param.name, paramType + param.type_dimension, {paramData: param});
        }

        if (methodData.return_type !== "void") {
            addNodeInput(node, "RETURN", methodData.return_type + methodData.return_type_dimension);
        }
    } else {
        for (let p = 0; p < methodData.parameters.length; p++) {
            let param = methodData.parameters[p];
            addNodeInput(node, param.name, param.type + param.type_dimension, {paramData: param});
        }

        if (methodData.return_type !== "void") {
            addNodeOutput(node, "RETURN", methodData.return_type + methodData.return_type_dimension);
        }
    }
}

function checkLambda(classData, methodData) {
    return (classData.methods.length === 1 || countNonDefaultMethods(classData) === 1) && classData.isInterface && methodData.isAbstract
}

function countNonDefaultMethods(classData) {
    let c = 0;
    for (let m = 0; m < classData.methods.length; m++) {
        if (!classData.methods[m].isDefault) c++;
    }
    return c;
}

function addNodeInput(node, name, type, options) {
    if (node.inputs) {
        for (let s = 0; s < node.inputs.length; s++) {
            if (node.inputs[s].name === name) {
                return;
            }
        }
    }
    if(!options) options = {};
    if (!options.color_on && !options.color_off) {
        let colors = getColorsForType(type);
        if (colors) {
            options.color_on = colors[0];
            options.color_off = colors[1];
        }
    }
    node.addInput(name, type, options);
    return node.inputs.length - 1;
}

function addNodeOutput(node, name, type, options) {
    if (node.outputs) {
        for (let s = 0; s < node.outputs.length; s++) {
            if (node.outputs[s].name === name) {
                return;
            }
        }
    }
    if(!options) options = {};
    if (!options.color_on && !options.color_off) {
        let colors = getColorsForType(type);
        if (colors) {
            options.color_on = colors[0];
            options.color_off = colors[1];
        }
    }
    node.addOutput(name, type, options);
    return node.outputs.length - 1;
}

function getColorsForType(type) {
    switch (type) {
        case "boolean":
            return [Colors.BOOLEAN_ON, Colors.BOOLEAN_OFF];
        case "string":
        case "java.lang.String":
            return [Colors.STRING_ON, Colors.STRING_OFF];
        case "byte":
        case "char":
        case "short":
        case "int":
        case "long":
        case "float":
        case "double":
            return [Colors.NUMBER_ON, Colors.NUMBER_OFF];
    }

    if (objectClasses.indexOf(type) !== -1) {
        return [Colors.OBJECT_ON, Colors.OBJECT_OFF];
    }
    if (enumClasses.indexOf(type) !== -1) {
        return [Colors.ENUM_ON, Colors.ENUM_OFF];
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