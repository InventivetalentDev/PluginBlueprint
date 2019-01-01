const fs = require("fs");
const path = require("path");
const {LiteGraph} = require("../node_modules/litegraph.js/build/litegraph");
const Colors = require("./colors");
const ClassDataStore = require("./classDataStore");

const nativeNodes = require("./nativeNodes");
const constantNodes = require("./nodes/constants");
const arithmeticNodes = require("./nodes/arithmetic");
const relationalNodes = require("./nodes/relational");
const variableNodes = require("./nodes/variables");
const arrayNodes = require("./nodes/array");

const classStore = new ClassDataStore();

// const classesByName = {};
//
// const eventClasses = [];
// const objectClasses = [];
// const enumClasses = [];
//
// const methods = [];
//
// const canvasMenuData = {};

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
};

const optionalInputOutputSorter = function (a, b) {
    var nameA = a[0].toUpperCase(); // ignore upper and lowercase
    var nameB = b[0].toUpperCase(); // ignore upper and lowercase


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
};

function onEventAdd(node, options, e, prevMenu) {
    let entries = [];
    let existingCategories = [];
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!c.startsWith("org.bukkit")) continue;
        let clazz = classesByName[c];
        if (!clazz.isEvent) continue;
        let v = clazz.name.substr("org.".length).split(".");
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
        for (let c in classesByName) {
            if (!c.startsWith("org.bukkit")) continue;
            let clazz = classesByName[c];
            if (!clazz.isEvent) continue;
            let v0 = clazz.name.substr("org.".length).split(".");
            v0.pop();
            let v1 = v0.join(".");
            if (v.value === v1) {
                let v2 = clazz.name.substr("org.".length).split(".");
                values.push({content: v2[v2.length - 1], value: clazz.name});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitClassNode(v.value);
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
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!c.startsWith("org.bukkit")) continue;
        let clazz = classesByName[c];
        if (!clazz.isObject) continue;
        let v = clazz.name.substr("org.".length).split(".");
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
        for (let c in classesByName) {
            if (!c.startsWith("org.bukkit")) continue;
            let clazz = classesByName[c];
            if (!clazz.isObject) continue;
            let v0 = clazz.name.substr("org.".length).split(".");
            v0.pop();
            let v1 = v0.join(".");
            if (v.value === v1) {
                let v2 = clazz.name.substr("org.".length).split(".");
                values.push({content: v2[v2.length - 1], value: clazz.name});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitClassNode(v.value);
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
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!c.startsWith("org.bukkit")) continue;
        let clazz = classesByName[c];

        let v = clazz.name.substr("org.".length).split(".");
        v.pop();
        let v1 = v.join(".");
        console.log(v1)
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
        for (let c in classesByName) {
            if (!c.startsWith("org.bukkit")) continue;
            let clazz = classesByName[c];

            let split = clazz.name.substr("org.".length).split(".");
            let lastSplit = split.pop();
            if (v.value === split.join(".")) {
                let simpleName = clazz.name;
                if (existingCategories.indexOf(simpleName) === -1) {
                    values.push({content: lastSplit, value: simpleName, has_submenu: true});
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
        for (let c in classesByName) {
            if (!c.startsWith("org.bukkit")) continue;
            let clazz = classesByName[c];
            if (v.value === clazz.name) {
                for (let m in clazz.methodsBySignature) {
                    let method = clazz.methodsBySignature[m];
                    if (existingCategories.indexOf(m) === -1) {
                        values.push({content: method.fullSignature, value: {class: clazz.name, method: method.fullSignature}, has_submenu: false});
                        existingCategories.push(m);
                    }
                }
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu1});
        return false;
    }

    function inner_create(v, e) {
        var first_event = prevMenu.getFirstEvent();
        let nodeName = getOrCreateBukkitMethodNode(v.value.class, v.value.method);
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
    return new Promise((resolve => {
        // Clear default node types
        LiteGraph.registered_node_types = {};
        LiteGraph.Nodes = {};

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

        for (let n = 0; n < nativeNodes.length; n++) {
            let nativeNode = nativeNodes[n];
            LiteGraph.registerNodeType("native/" + nativeNode.name, nativeNode);
        }
        for (let n = 0; n < arithmeticNodes.length; n++) {
            LiteGraph.registerNodeType("arithmetic/" + arithmeticNodes[n].name, arithmeticNodes[n]);
        }
        for (let n = 0; n < relationalNodes.length; n++) {
            LiteGraph.registerNodeType("relational/" + relationalNodes[n].name, relationalNodes[n]);
        }
        for (let n = 0; n < constantNodes.length; n++) {
            LiteGraph.registerNodeType("constants/" + constantNodes[n].name, constantNodes[n]);
        }
        for (let n = 0; n < variableNodes.length; n++) {
            LiteGraph.registerNodeType("variables/" + variableNodes[n].name, variableNodes[n]);
        }
        for (let n = 0; n < arrayNodes.length; n++) {
            LiteGraph.registerNodeType("arrays/" + arrayNodes[n].name, arrayNodes[n]);
        }

        classStore.init().then(() => {
            console.log("Generating & Registering Java nodes...");
            let classesByName = classStore.getClassesByName();
            for (let n in classesByName) {
                let clazz = classesByName[n];
                getOrCreateBukkitClassNode(clazz.name);
                for (let m in clazz.methodsBySignature) {
                    let method = clazz.methodsBySignature[m];
                    getOrCreateBukkitMethodNode(clazz.qualifiedName, method.fullSignature);
                }
            }
            resolve();
        });
    }))
}

function getOrCreateBukkitClassNode(className) {
    let classData = classStore.getClass(className);
    if (!classData) {
        console.warn("Class " + className + " does not exist or isn't loaded");
        return null;
    }

    let simpleClassName = classData.simpleName;
    // let packageSplit = className.substr("org.".length).split(".");
    // if (packageSplit.length > 2 && packageSplit[packageSplit.length - 2].charAt(0) === packageSplit[packageSplit.length - 2].charAt(0).toUpperCase()) {
    //     simpleClassName = packageSplit[packageSplit.length - 2] + "." + packageSplit[packageSplit.length - 1];
    //     let temp = packageSplit[packageSplit.length - 2] + "." + packageSplit[packageSplit.length - 1];
    //     packageSplit.pop();
    //     packageSplit[packageSplit.length - 1] = temp;
    //
    // }
    let categoryName = classData.qualifiedName;

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitClassNode() {
        addClassIO(this, classData);

        if (this.inputs)
            this.inputs.sort(inputOutputSorter);
        if (this.optional_inputs)
            this.optional_inputs.sort(optionalInputOutputSorter);
        if (this.outputs)
            this.outputs.sort(inputOutputSorter);
        if (this.optional_outputs)
            this.optional_outputs.sort(optionalInputOutputSorter);

        this.nodeType = "BukkitClassNode";

        if (classData.isEvent) {
            this.classType = "event";
            this.color = Colors.EVENT;
        } else if (classData.isEnum) {
            this.classType = "enum";
            this.color = Colors.ENUM_OFF;//TODO: separate variable
        } else {
            this.classType = "object";
            this.color = Colors.OBJECT;
        }

        this.className = classData.name;
    }

    BukkitClassNode.title = simpleClassName;

    BukkitClassNode.prototype.getMenuOptions = function () {
        return [
            {content: "Inputs", has_submenu: true, disabled: !this.optional_inputs || this.optional_inputs.length === 0, callback: LGraphCanvas.showMenuNodeOptionalInputs},
            {content: "Outputs", has_submenu: true, disabled: !this.optional_outputs || this.optional_outputs.length === 0, callback: LGraphCanvas.showMenuNodeOptionalOutputs},
            null
        ];
    };
    BukkitClassNode.prototype.onConfigure = function () {
        this.size = this.computeSize();
    };

    BukkitClassNode.prototype.onOutputDblClick = function (i, e) {
        handleSlotDoubleClick(this, i, e);
    };
    BukkitClassNode.prototype.onDblClick = function () {
        console.log(this);
    };

    LiteGraph.registerNodeType(categoryName, BukkitClassNode);

    return categoryName;
}

function addClassIO(node, classData, isChildCall) {
    if (!isChildCall) {
        if (!classData.isEvent && !classData.isEnum && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeInput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
        }
        if (!classData.isEnum && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeOutput(node, "EXEC", "@EXEC", {shape: LiteGraph.ARROW_SHAPE, color_off: Colors.EXEC_OFF, color_on: Colors.EXEC_ON});
        }
    }

    if (!isChildCall && classData.isObject && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
        addNodeInput(node, "REF", classData.name, {linkType: "ref", shape: LiteGraph.BOX_SHAPE, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON})
    }
    if (!isChildCall && !classData.isEnum) {
        addNodeOutput(node, "THIS", classData.name, {linkType: "this", shape: LiteGraph.BOX_SHAPE, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON})
    }


    if (classData.isEnum && classData.enumConstants.length > 0) {
        let i = addNodeOutput(node, classData.enumConstants[0], classData.name, {linkType: "enum", className: classData.name, enumName: classData.enumConstants[0], color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON});
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
        for (let c=0;c<classData.constructors.length;c++) {
            let constructor = classData.constructors[c];
            for (let i = 0; i < constructor.parameters.length; i++) {
                let param = constructor.parameters[i];
                addNodeInput(node, param.name, param.type.qualifiedName, {linkType: "constructorParam", constructorName: constructor.name, paramName: param.name})
            }
        }
    }


    for (let m in classData.methodsBySignature) {
        let method = classData.methodsBySignature[m];


        let methodSignature = method.fullSignature;


        let isLambda = checkLambda(classData, method);

        /*if (method.name.startsWith("get")) {
            addNodeOutput(node,method.name.substr(3), method.return_type);
        } else if (method.name.startsWith("set")) {
            addNodeInput(node,method.name.substr(3), method.return_type);
        } else*/
        if (method.return_type === "void") {
            addNodeOutput(node, methodSignature, classData.name + "#" + methodSignature, {
                linkType: isLambda ? "abstractMethod" : "method",
                className: classData.name,
                methodName: method.name,
                methodSignature: method.fullSignature,
                shape: LiteGraph.BOX_SHAPE,
                color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF,
                color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON
            }, true);
        } else if (method.parameters.length === 0) {
            let returnData = classStore.getClass(method.returnType.qualifiedName);
            if (method.returnType.qualifiedName === "boolean") {
                addNodeOutput(node, method.name, method.returnType.qualifiedName + method.returnType.dimension, {linkType: "getter", returnType: method.returnType.qualifiedName, className: classData.name, methodName: method.name, methodSignature: method.fullSignature, color_off: Colors.BOOLEAN_OFF, color_on: Colors.BOOLEAN_ON}, true);
            } else if (method.returnType.qualifiedName === "number" || method.returnType.qualifiedName === "int" || method.returnType.qualifiedName === "double" || method.returnType.qualifiedName === "float" || method.returnType.qualifiedName === "short" || method.returnType.qualifiedName === "long" || method.returnType.qualifiedName === "byte") {
                addNodeOutput(node, method.name, method.return_type + method.returnType.dimension, {linkType: "getter", returnType: method.return_type, className: classData.name, methodName: method.name, methodSignature: method.fullSignature, color_off: Colors.NUMBER_OFF, color_on: Colors.NUMBER_ON}, true);
            } else if (method.returnType.qualifiedName === "string" || method.returnType.qualifiedName === "java.lang.String") {
                addNodeOutput(node, method.name, method.returnType.qualifiedName + method.returnType.dimension, {linkType: "getter", returnType: method.returnType.qualifiedName, className: classData.name, methodName: method.name, methodSignature: method.fullSignature, color_off: Colors.STRING_OFF, color_on: Colors.STRING_ON}, true);
            } else if (returnData && returnData.isObject) {
                addNodeOutput(node, method.name, method.returnType.qualifiedName + method.returnType.dimension, {linkType: "object", returnType: method.returnType.qualifiedName, className: classData.name, methodName: method.name, methodSignature: method.fullSignature, color_off: Colors.OBJECT_OFF, color_on: Colors.OBJECT_ON}, true);
            } else if (returnData && returnData.isEnum) {
                addNodeOutput(node, method.name, method.returnType.qualifiedName + method.returnType.dimension, {linkType: "enum", returnType: method.returnType.qualifiedName, className: classData.name, methodName: method.name, methodSignature: method.fullSignature, color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON}, true);
            } else {
                // addNodeOutput(node,method.name, method.return_type);
                addNodeOutput(node, method.name, classData.name + "#" + methodSignature, {
                    linkType: isLambda ? "abstractMethod" : "method",
                    className: classData.name,
                    methodName: method.name,
                    methodSignature: method.fullSignature,
                    shape: LiteGraph.BOX_SHAPE,
                    color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF,
                    color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON
                }, true);
            }
        } else {
            addNodeOutput(node, methodSignature, classData.name + "#" + methodSignature, {
                linkType: isLambda ? "abstractMethod" : "method",
                className: classData.name,
                methodName: method.name,
                methodSignature: method.fullSignature,
                shape: LiteGraph.BOX_SHAPE,
                color_off: isLambda ? Colors.ABSTRACT_FUNCTION_OFF : Colors.FUNCTION_OFF,
                color_on: isLambda ? Colors.ABSTRACT_FUNCTION_ON : Colors.FUNCTION_ON
            }, true);
        }
    }

    // Interfaces
    if (classData.interfaces) {
        for (let i = 0; i < classData.interfaces.length; i++) {
            let interfaceData = classStore.getClass(classData.interfaces[i]);
            if(interfaceData) {
                addClassIO(node, interfaceData, true);
            }else{
                console.warn("Missing class data for interface class " + classData.interfaces[i]);
            }
        }
    }
    // Superclass
    if (classData.superclass && classData.superclass.length > 0 && classData.superclass !== "java.lang.Object" && classData.superclass !== "java.lang.Enum") {
        console.log(classData.superclass);
        let superData = classStore.getClass(classData.superclass);
        if(superData) {
            addClassIO(node, superData, true);
        }else{
            console.warn("Missing class data for superclass " + classData.superclass);
        }
    }
}

function getOrCreateBukkitMethodNode(className, methodSignature) {

    let classData = classStore.getClass(className);
    if (!classData) {
        console.warn("Class " + className + " does not exist or isn't loaded");
        return null;
    }
    let simpleClassName = classData.simpleName;

    let methodData = classStore.getMethod(className, methodSignature);
    if (!methodData) {
        console.warn("Missing method data for " + methodSignature + " in " + className);
        return null;
    }

    let categoryName = className + "#" + methodSignature;

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitMethodNode() {
        addMethodIO(this, classData, methodData);
        this.nodeType = "BukkitMethodNode";
        this.className = classData.name;
        this.methodName = methodData.name;
        this.methodSignature = methodData.fullSignature;
    }

    BukkitMethodNode.title = simpleClassName + "#" + methodSignature;

    BukkitMethodNode.prototype.color = Colors.FUNCTION;

    BukkitMethodNode.prototype.getMenuOptions = function () {
        return [
            {content: "Inputs", has_submenu: true, disabled: !this.optional_inputs || this.optional_inputs.length === 0, callback: LGraphCanvas.showMenuNodeOptionalInputs},
            {content: "Outputs", has_submenu: true, disabled: !this.optional_outputs || this.optional_outputs.length === 0, callback: LGraphCanvas.showMenuNodeOptionalOutputs},
            null
        ];
    };
    BukkitMethodNode.prototype.onConfigure = function () {
        this.size = this.computeSize();
    };

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

    let methodSignature = methodData.fullSignature;

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
            let paramType = methodData.parameters[p].type.typeVariable ? "java.lang.Object" : param.type.qualifiedName;

            addNodeOutput(node, param.name, paramType + param.type.dimension, {paramName: param.name});
        }

        if (methodData.returnType.qualifiedName !== "void") {
            addNodeInput(node, "RETURN", methodData.returnType.qualifiedName + methodData.returnType.dimension, {returnType: methodData.returnType.qualifiedName});
        }
    } else {
        for (let p = 0; p < methodData.parameters.length; p++) {
            let param = methodData.parameters[p];
            addNodeInput(node, param.name, param.type.qualifiedName + param.type.dimension, {paramName: param.name});
        }

        if (methodData.return_type !== "void") {
            addNodeOutput(node, "RETURN", methodData.returnType.qualifiedName + methodData.returnType.dimension, {returnType: methodData.returnType.qualifiedName});
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

function addNodeInput(node, name, type, options, optional) {
    if (!node.optional_inputs) node.optional_inputs = [];
    if (!node.inputs) node.inputs = [];
    if (optional) {
        for (let s = 0; s < node.optional_inputs.length; s++) {
            if (node.optional_inputs[s][0] === name) {
                return;
            }
        }
    } else {
        for (let s = 0; s < node.inputs.length; s++) {
            if (node.inputs[s].name === name) {
                return;
            }
        }
    }
    if (!options) options = {};
    if (!options.locked) options.locked = !optional;
    options.nameLocked = true;
    if (!options.color_on && !options.color_off) {
        let colors = getColorsForType(type);
        if (colors) {
            options.color_on = colors[0];
            options.color_off = colors[1];
        }
    }
    if (optional) {
        node.optional_inputs.push([name, type, options]);
    } else {
        node.addInput(name, type, options);
    }
    return node.inputs.length - 1;
}

function addNodeOutput(node, name, type, options, optional) {
    if (!node.optional_outputs) node.optional_outputs = [];
    if (!node.outputs) node.outputs = [];
    if (optional) {
        for (let s = 0; s < node.optional_outputs.length; s++) {
            if (node.optional_outputs[s][0] === name) {
                return;
            }
        }
    } else {
        for (let s = 0; s < node.outputs.length; s++) {
            if (node.outputs[s].name === name) {
                return;
            }
        }
    }
    if (!options) options = {};
    if (!options.locked) options.locked = !optional;
    options.nameLocked = true;
    if (!options.color_on && !options.color_off) {
        let colors = getColorsForType(type);
        if (colors) {
            options.color_on = colors[0];
            options.color_off = colors[1];
        }
    }
    if (optional) {
        node.optional_outputs.push([name, type, options]);
    } else {
        node.addOutput(name, type, options);
    }
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

    let classInfo = classStore.getClass(type);
    if (classInfo) {
        if (classInfo.isEnum) {
            return [Colors.ENUM_ON, Colors.ENUM_OFF];
        }
        if (classInfo.isObject) {
            return [Colors.OBJECT_ON, Colors.OBJECT_OFF];
        }
    }
}

function handleSlotDoubleClick(node, i, e) {
    console.log("onOutputDblClick");
    let slot = node.getOutputInfo(i);
    console.log(slot);

    let nodeName;
    if (slot.name === "RETURN" || slot.hasOwnProperty("returnType")) {
        nodeName = getOrCreateBukkitClassNode(slot.returnType);
    } else if (slot.type.indexOf("#") !== -1) {
        nodeName = getOrCreateBukkitMethodNode(slot.className, slot.methodSignature);//TODO: update params
    } else /*if (slot.type.startsWith("org.bukkit") && classesByName.hasOwnProperty(slot.type))*/ {
        nodeName = getOrCreateBukkitClassNode(slot.className);
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