import fs = require("fs");
import path = require("path");
import {shell} from 'electron';
import {LiteGraph, LGraph, LGraphCanvas, LGraphNode} from "../../assets/lib/litegraph/litegraph";
import Colors = require("./colors");
import ClassDataStore = require("./classDataStore");
import {shapeAndColorsForSlotType, isPrimitiveType, updateLinkColors, scrollSpeedForLength, handleDescDrawBackground, handleDescOnBounding, isNumberType, javaType} from "./util";
import {firstSentence} from "./nodeSearch";
import {openPicker} from "./picker";

import type {ContextMenuItem, IContextMenuItem, IContextMenuOptions, INodeSlot, LGraphNodeConstructor} from "../../assets/lib/litegraph/litegraph";
import type {ClassData, ConstructorData, FieldData, MethodData} from "../types/classData";
import type {LiteGraphExtras, OptionalSlot, SlotType} from "../types/litegraph-augment";
import type {NodeModule} from "../types/nodes";

interface BukkitNode extends LGraphNode {
    nodeType: "BukkitClassNode" | "BukkitMethodNode" | "BukkitAbstractMethodNode" | "BukkitConstructorNode" | "BukkitStaticFieldNode";
    classType?: "event" | "enum" | "object";
    className: string;
    methodName?: string;
    methodSignature?: string;
    constructorName?: string;
    constructorSignature?: string;
    isClassNode?: boolean;
    isMethodNode?: boolean;
    isAbstractMethod?: boolean;
    isAbstractMethodNode?: boolean;
    isConstructorNode?: boolean;
    onDblClick?(): void;
}

type MenuEntry<T> = IContextMenuItem & {value: T};
type Menu = InstanceType<typeof LiteGraph.ContextMenu>;
type MenuOptions = IContextMenuOptions & {node?: LGraphNode; scroll_speed?: number};
type SlotMenuOptions = MenuOptions & {type: number; skipDuplicates?: boolean};
type SlotMenuEntry = MenuEntry<NonNullable<OptionalSlot>> & {
    callback?: (this: LGraphCanvas, node: LGraphNode, entry: ContextMenuItem, options: IContextMenuOptions, event: MouseEvent) => void;
};
type CanvasMouseEvent = MouseEvent & {canvasX: number; canvasY: number};

import miscNodes = require("./nodes/misc");
import constantNodes = require("./nodes/constants");
import arithmeticNodes = require("./nodes/arithmetic");
import relationalNodes = require("./nodes/relational");
import variableNodes = require("./nodes/variables");
import arrayNodes = require("./nodes/array");
import flowNodes = require("./nodes/flow");
import logicNodes = require("./nodes/logic");
import eventNodes = require("./nodes/events");
import annotationNodes = require("./nodes/annotations");
import commandNodes = require("./nodes/commands");
import configNodes = require("./nodes/config");
import codeNodes = require("./nodes/code");
import subgraphNodes = require("./nodes/subgraph");

const nodes: [string, NodeModule][] = [
    // category, import
    ["native", require("./nodes/misc") as typeof miscNodes],
    ["arithmetic", require("./nodes/arithmetic") as typeof arithmeticNodes],
    ["relational", require("./nodes/relational") as typeof relationalNodes],
    ["constants", require("./nodes/constants") as typeof constantNodes],
    ["variables", require("./nodes/variables") as typeof variableNodes],
    ["arrays", require("./nodes/array") as typeof arrayNodes],
    ["flow", require("./nodes/flow") as typeof flowNodes],
    ["logic", require("./nodes/logic") as typeof logicNodes],
    ["events", require("./nodes/events") as typeof eventNodes],
    ["annotations", require("./nodes/annotations") as typeof annotationNodes],
    ["commands", require("./nodes/commands") as typeof commandNodes],
    ["config", require("./nodes/config") as typeof configNodes],
    ["code", require("./nodes/code") as typeof codeNodes],
    ["graph", require("./nodes/subgraph") as typeof subgraphNodes]
];

const classStore = new ClassDataStore();
const isValidConnection = (LiteGraph as typeof LiteGraph & LiteGraphExtras).isValidConnection;
(LiteGraph as typeof LiteGraph & LiteGraphExtras).isValidConnection = function (outputType: SlotType, inputType: SlotType) {
    if (inputType === "java.lang.Object") return outputType !== "@EXEC";
    if (typeof outputType === "string" && typeof inputType === "string" && inputType.toLowerCase() === "org.bukkit.event.cancellable" && classStore.isAssignableTo(outputType, inputType)) return true;
    return isValidConnection.apply(this, arguments as IArguments & [SlotType, SlotType]);
};
// The editor does not use slot-type search, so skip registry sorting for each slot.
(LiteGraph as typeof LiteGraph & LiteGraphExtras).registerNodeAndSlotType = function () {};


const inputOutputSorter = function (a: INodeSlot, b: INodeSlot) {
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

const optionalInputOutputSorter = function (a: OptionalSlot, b: OptionalSlot) {
    var nameA = a![0].toUpperCase(); // ignore upper and lowercase
    var nameB = b![0].toUpperCase(); // ignore upper and lowercase


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

function isApiClass(c: string) {
    return c.startsWith("org.bukkit") || c.startsWith("io.papermc.paper") ||
        c.startsWith("com.destroystokyo.paper") || c.startsWith("net.kyori.adventure");
}

function onEventAdd(node: ContextMenuItem, options: IContextMenuOptions, e: MouseEvent, prevMenu: Menu | undefined) {
    let entries = [];
    let existingCategories = [];
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!isApiClass(c)) continue;
        let clazz = classesByName[c];
        if (clazz.isDeprecated) continue;
        if (!clazz.isEvent) continue;
        let v1 = clazz.package;
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: true});
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu});

    function inner_clicked(v: ContextMenuItem, option: IContextMenuOptions, e: MouseEvent) {
        var values = [];
        for (let c in classesByName) {
            if (!isApiClass(c)) continue;
            let clazz = classesByName[c];
            if (clazz.isDeprecated) continue;
            if (!clazz.isEvent) continue;
            let v1 = clazz.package;
            if ((v as MenuEntry<string>).value === v1) {
                let v2 = clazz.name;
                values.push({content: v2, value: clazz.qualifiedName});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu});
        return false;
    }

    function inner_create(v: ContextMenuItem, e: IContextMenuOptions) {
        var first_event = (prevMenu!.getFirstEvent as () => MouseEvent)();
        let nodeName = getOrCreateBukkitClassNode((v as MenuEntry<string>).value);
        var node = LiteGraph.createNode(nodeName!);
        if (node) {
            node.pos = canvas.convertEventToCanvasOffset(first_event);
            canvas.graph!.add(node);
        }
    }
}

function onObjectAdd(node: ContextMenuItem, options: IContextMenuOptions, e: MouseEvent, prevMenu: Menu | undefined) {
    let entries = [];
    let existingCategories = [];
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!isApiClass(c)) continue;
        let clazz = classesByName[c];
        if (clazz.isDeprecated) continue;
        if (clazz.isEvent || (!clazz.isObject && !clazz.isEnum)) continue;
        let v1 = clazz.package;
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: true});
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu, scroll_speed: scrollSpeedForLength(entries.length)} as MenuOptions);

    function inner_clicked(v: ContextMenuItem, option: IContextMenuOptions, e: MouseEvent) {
        var values = [];
        for (let c in classesByName) {
            if (!isApiClass(c)) continue;
            let clazz = classesByName[c];
            if (clazz.isDeprecated) continue;
            if (clazz.isEvent || (!clazz.isObject && !clazz.isEnum)) continue;
            let v1 = clazz.package;
            if ((v as MenuEntry<string>).value === v1) {
                let v2 = clazz.name;
                values.push({content: v2, value: clazz.qualifiedName});
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu, scroll_speed: scrollSpeedForLength(values.length)} as MenuOptions);
        return false;
    }

    function inner_create(v: ContextMenuItem, e: IContextMenuOptions) {
        var first_event = (prevMenu!.getFirstEvent as () => MouseEvent)();
        let nodeName = getOrCreateBukkitClassNode((v as MenuEntry<string>).value);
        var node = LiteGraph.createNode(nodeName!);
        if (node) {
            node.pos = canvas.convertEventToCanvasOffset(first_event);
            canvas.graph!.add(node);
        }
    }
}

function onConstantAdd(node: ContextMenuItem, options: IContextMenuOptions, e: MouseEvent, prevMenu: Menu | undefined) {
    const constants = Object.entries(LiteGraph.registered_node_types).filter(([type]) => type.includes("#static:") && isApiClass(type) && !classStore.getClass(type.split("#")[0])!.isDeprecated);
    const packages = [...new Set(constants.map(([type]) => classStore.getClass(type.split("#")[0])!.package))];
    const entries = packages.map(name => ({content: name, value: name, has_submenu: true}));
    const menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu, scroll_speed: scrollSpeedForLength(entries.length)} as MenuOptions);

    function inner_clicked(v: ContextMenuItem, options: IContextMenuOptions, e: MouseEvent) {
        const values = constants.filter(([type]) => {
            const clazz = classStore.getClass(type.split("#")[0])!;
            return clazz.package === (v as MenuEntry<string>).value;
        }).map(([type, constructor]) => ({content: (constructor as LGraphNodeConstructor & {title: string}).title, value: type}));
        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu, scroll_speed: scrollSpeedForLength(values.length)} as MenuOptions);
        return false;
    }

    function inner_create(v: ContextMenuItem) {
        const firstEvent = (prevMenu!.getFirstEvent as () => MouseEvent)();
        const node = LiteGraph.createNode((v as MenuEntry<string>).value);
        if (node) {
            node.pos = canvas.convertEventToCanvasOffset(firstEvent);
            canvas.graph!.add(node);
        }
    }
}

function onMethodAdd(node: ContextMenuItem, options: IContextMenuOptions, e: MouseEvent, prevMenu: Menu | undefined) {
    let entries = [];
    let existingCategories = [];
    let classesByName = classStore.getClassesByName();
    for (let c in classesByName) {
        if (!isApiClass(c)) continue;
        let clazz = classesByName[c];
        if (clazz.isDeprecated) continue;

        let v1 = clazz.package;
        if (existingCategories.indexOf(v1) === -1) {
            entries.push({value: v1, content: v1, has_submenu: true});
            existingCategories.push(v1);
        }
    }

    let menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prevMenu, scroll_speed: scrollSpeedForLength(entries.length)} as MenuOptions);
    let menu1: Menu;

    function inner_clicked(v: ContextMenuItem, option: IContextMenuOptions, e: MouseEvent) {
        var values = [];
        let existingCategories = [];
        for (let c in classesByName) {
            if (!isApiClass(c)) continue;
            let clazz = classesByName[c];
            if (clazz.isDeprecated) continue;

            if ((v as MenuEntry<string>).value === clazz.package) {
                let simpleName = clazz.name;
                if (existingCategories.indexOf(simpleName) === -1) {
                    values.push({content: simpleName, value: clazz.qualifiedName, has_submenu: true});
                    existingCategories.push(simpleName)
                }
            }
        }

        menu1 = new LiteGraph.ContextMenu(values, {event: e, callback: inner2_clicked, parentMenu: menu, scroll_speed: scrollSpeedForLength(values.length)} as MenuOptions);
        return false;
    }

    function inner2_clicked(v: ContextMenuItem, option: IContextMenuOptions, e: MouseEvent) {
        var values = [];
        let existingCategories = [];
        for (let c in classesByName) {
            if (!isApiClass(c)) continue;
            let clazz = classesByName[c];
            if (clazz.isDeprecated) continue;
            if ((v as MenuEntry<string>).value === clazz.qualifiedName) {
                for (let m in clazz.methodsBySignature) {
                    let method = clazz.methodsBySignature[m];
                    if (method.isDeprecated) continue;
                    if (existingCategories.indexOf(m) === -1) {
                        values.push({content: method.fullFlatSignature, value: {class: clazz.qualifiedName, method: method.fullSignature}, has_submenu: false});
                        existingCategories.push(m);
                    }
                }
            }
        }

        new LiteGraph.ContextMenu(values, {event: e, callback: inner_create, parentMenu: menu1, scroll_speed: scrollSpeedForLength(values.length)} as MenuOptions);
        return false;
    }

    function inner_create(v: ContextMenuItem, e: IContextMenuOptions) {
        var first_event = (prevMenu!.getFirstEvent as () => MouseEvent)();
        let nodeName = getOrCreateBukkitMethodNode((v as MenuEntry<{class: string; method: string}>).value.class, (v as MenuEntry<{class: string; method: string}>).value.method);
        console.log(nodeName);
        var node = LiteGraph.createNode(nodeName!);
        console.log(node);
        if (node) {
            node.pos = canvas.convertEventToCanvasOffset(first_event);
            canvas.graph!.add(node);
        }
    }
}

function showOptionalSlotMenu(v: ContextMenuItem, opts: SlotMenuOptions, e: MouseEvent, prev_menu: Menu | undefined, node: LGraphNode | undefined) {
    if (!node)
        return;

    var canvas = (LGraphCanvas as typeof LGraphCanvas & {active_canvas: LGraphCanvas}).active_canvas;
    var ref_window = canvas.getCanvasWindow();

    var options = opts.type === LiteGraph.OUTPUT ? node.optional_outputs : node.optional_inputs;

    var entries = [];
    if (options)
        for (var i in options) {
            var entry = options[i];
            if (!entry) //separator?
            {
                entries.push(null);
                continue;
            }

            if (opts.skipDuplicates && node.findOutputSlot(entry[0]) != -1)
                continue; //skip the ones already on
            var label = entry[0];
            if (entry[2] && entry[2].label)
                label = entry[2].label;
            var data = {content: label, value: entry};
            entries.push(data);
        }

    if (!entries.length)
        return;

    var menu = new LiteGraph.ContextMenu(entries, {event: e, callback: inner_clicked, parentMenu: prev_menu, node: node, scroll_speed: scrollSpeedForLength(entries.length)} as MenuOptions, ref_window);

    function inner_clicked(v: ContextMenuItem, e: IContextMenuOptions, prev: MouseEvent) {
        if (!node)
            return;

        if ((v as SlotMenuEntry).callback)
            (v as SlotMenuEntry).callback!.call(canvas, node, v, e, prev);

        if (!(v as SlotMenuEntry).value)
            return;

        if (opts.type === LiteGraph.OUTPUT) {
            node.addOutput((v as SlotMenuEntry).value[0], (v as SlotMenuEntry).value[1] as INodeSlot["type"], (v as SlotMenuEntry).value[2]);
        } else {
            node.addInput((v as SlotMenuEntry).value[0], (v as SlotMenuEntry).value[1] as INodeSlot["type"], (v as SlotMenuEntry).value[2]);
        }
        node.setDirtyCanvas(true, true);
    }

    return false;
}

function init() {
    return new Promise<void>((resolve => {
        // Clear default node types
        LiteGraph.registered_node_types = {};
        LiteGraph.Nodes = {};

        LGraphCanvas.prototype.getMenuOptions = function (this: LGraphCanvas) {
            return [
                {content: "Add Generic Node", has_submenu: true, callback: LGraphCanvas.onMenuAdd},
                null,
                {content: "Add Bukkit Event", has_submenu: true, callback: onEventAdd},
                {content: "Add Bukkit Object", has_submenu: true, callback: onObjectAdd},
                {content: "Add Bukkit Constant", has_submenu: true, callback: onConstantAdd},
                {content: "Add Bukkit Method", has_submenu: true, callback: onMethodAdd},
                null,
                {content: "Add Group", callback: LGraphCanvas.onGroupAdd}
            ]
        };


        LGraphCanvas.link_type_colors = Object.assign(LGraphCanvas.link_type_colors, {
            "@EXEC": Colors.EXEC_ON,
            "boolean": Colors.BOOLEAN_ON,
            "java.lang.String": Colors.STRING_ON,
            "byte": Colors.NUMBER_ON,
            "char": Colors.NUMBER_ON,
            "short": Colors.NUMBER_ON,
            "int": Colors.NUMBER_ON,
            "long": Colors.NUMBER_ON,
            "float": Colors.NUMBER_ON,
            "double": Colors.NUMBER_ON,
            "method": Colors.FUNCTION_ON,
            "abstractMethod": Colors.ABSTRACT_FUNCTION_ON,
            "staticMethod": Colors.STATIC_FUNCTION_ON,
            "object": Colors.OBJECT_ON,
            "this": Colors.OBJECT_ON,
            "enum": Colors.ENUM_ON,

        });

        LGraphNode.prototype.onConnectionsChange = function (this: LGraphNode, slotType: number, slot: number) {
            updateLinkColors(slotType, this, slot);
        };
        LGraphNode.prototype.getMenuOptions = function (this: LGraphNode) {
            return [
                {
                    content: "Inputs", has_submenu: true, disabled: !this.optional_inputs || this.optional_inputs.length === 0, callback: function (v: ContextMenuItem, opts: IContextMenuOptions, e: MouseEvent, prev_menu: Menu | undefined, node: LGraphNode) {
                        return showOptionalSlotMenu(v, Object.assign({}, opts, {
                            skipDuplicates: true,
                            type: LiteGraph.INPUT
                        }), e, prev_menu, node)
                    }
                },
                {
                    content: "Outputs", has_submenu: true, disabled: !this.optional_outputs || this.optional_outputs.length === 0, callback: function (v: ContextMenuItem, opts: IContextMenuOptions, e: MouseEvent, prev_menu: Menu | undefined, node: LGraphNode) {
                        const classNode = node as LGraphNode & {classType?: string; className?: string};
                        if (["class", "object", "event"].includes(classNode.classType || "")) {
                            const groups = new Map<string, NonNullable<OptionalSlot>[]>();
                            function addGroup(name: string | null | undefined) {
                                if (!name || groups.has(name)) return;
                                groups.set(name, []);
                                const clazz = classStore.getClass(name);
                                for (const parent of clazz?.interfaces || []) addGroup(parent);
                                if (clazz?.superclass !== "java.lang.Object" && clazz?.superclass !== "java.lang.Enum") addGroup(clazz?.superclass);
                            }
                            addGroup(classNode.className);
                            for (const entry of node.optional_outputs || []) {
                                if (!entry || node.findOutputSlot(entry[0]) !== -1) continue;
                                const slot = entry[2];
                                if (classStore.getClass(slot?.className)?.isDeprecated ||
                                    classStore.getMethod(slot?.className, slot?.methodSignature)?.isDeprecated) continue;
                                const owner = slot?.className || classNode.className!;
                                if (!groups.has(owner)) groups.set(owner, []);
                                groups.get(owner)!.push(entry);
                            }
                            const entries = [...groups.values()].flat();
                            openPicker({
                                x: e.clientX, y: e.clientY,
                                placeholder: "Filter outputs",
                                items: entries.map((entry, index) => ({
                                    value: String(index), label: entry[0],
                                    detail: firstSentence(classStore.getMethod(entry[2]?.className, entry[2]?.methodSignature)?.comment),
                                    group: classStore.getClass(entry[2]?.className || classNode.className)?.simpleName
                                })),
                                onPick: value => {
                                    const entry = entries[Number(value)];
                                    node.addOutput(entry[0], entry[1], entry[2]);
                                    node.setDirtyCanvas(true, true);
                                }
                            });
                            return false;
                        }
                        return showOptionalSlotMenu(v, Object.assign({}, opts, {
                            skipDuplicates: true,
                            type: LiteGraph.OUTPUT
                        }), e, prev_menu, node)
                    }
                },
                null,
                {content: "Properties", has_submenu: true, disabled: !this.properties || Object.keys(this.properties).length === 0, callback: LGraphCanvas.onShowMenuNodeProperties}
            ];
        };
        LGraphNode.prototype.onConfigure = function (this: LGraphNode) {
            for (let i = 0; this.inputs && i < this.inputs.length; i++) {
                if (this.inputs[i].locked === false) {
                    this.inputs[i].removable = true;
                }
            }
            for (let i = 0; this.outputs && i < this.outputs.length; i++) {
                if (this.outputs[i].locked === false) {
                    this.outputs[i].removable = true;
                }
            }
            this.size = this.computeSize();
        };
        LGraphNode.prototype.onInputDblClick = function (this: BukkitNode, i: number, e: MouseEvent) {
            handleSlotDoubleClick(this, "in", i, e as CanvasMouseEvent);
        };
        LGraphNode.prototype.onOutputDblClick = function (this: BukkitNode, i: number, e: MouseEvent) {
            handleSlotDoubleClick(this, "out", i, e as CanvasMouseEvent);
        };
        (LGraphNode.prototype as BukkitNode).onDblClick = function (this: LGraphNode) {
            console.log(this);
        };
        LGraphNode.prototype.onMouseDown = function (this: BukkitNode, e: MouseEvent) {
            console.log(e);

            if(e.shiftKey) {
                let className = this.className;
                if (!className) {
                    return;
                }
                let classData = classStore.getClass(className);
                let meta = classStore.meta!;
                let url;
                if (className.startsWith("org.bukkit.") || className.startsWith("io.papermc.paper.") || className.startsWith("com.destroystokyo.paper.")) {
                    url = "https://jd.papermc.io/paper/" + meta.minecraftVersion + "/";
                } else if (className.startsWith("java.")) {
                    url = "https://docs.oracle.com/en/java/javase/" + meta.javaVersion + "/docs/api/java.base/";
                } else if (className.startsWith("net.kyori.adventure.")) {
                    let artifact = className.startsWith("net.kyori.adventure.text.minimessage.") ? "adventure-text-minimessage" :
                        className.startsWith("net.kyori.adventure.key.") ? "adventure-key" : "adventure-api";
                    url = "https://javadoc.io/doc/net.kyori/" + artifact + "/" + meta.adventureVersion + "/";
                }
                if (!url || !classData) {
                    return;
                }

                url += classData.package.split(".").join("/") + "/" + classData.name + ".html";

                shell.openExternal(url);
            }
        };

        LGraphNode.prototype.onDrawBackground = handleDescDrawBackground;
        LGraphNode.prototype.onBounding = handleDescOnBounding;

        for (let c = 0; c < nodes.length; c++) {
            let e = nodes[c];
            let category = e[0];
            let nods = e[1];

            for (let n = 0; n < nods.length; n++) {
                let node = nods[n];
                LiteGraph.registerNodeType(category + "/" + node.name, node as unknown as LGraphNodeConstructor);
            }
        }

        classStore.init().then(() => {
            console.log("Generating & Registering Nodes...");

            ensureNodeRegistration();
            resolve();
        });
    }))
}

function ensureNodeRegistration() {
    let classesByName = classStore.getClassesByName();
    for (let n in classesByName) {
        let clazz = classesByName[n];
        getOrCreateBukkitClassNode(clazz.qualifiedName);
        if (!clazz.isEnum) {
            const fieldsByType = new Map<string, FieldData[]>();
            for (const field of Object.values(clazz.fieldsByName)) {
                if (!field.isStatic || field.isDeprecated) continue;
                if (!field.type.isPrimitive && !classStore.getClass(field.type.qualifiedName)) continue;
                const group = fieldsByType.get(field.type.qualifiedName) || [];
                group.push(field);
                fieldsByType.set(field.type.qualifiedName, group);
            }
            for (const group of fieldsByType.values()) {
                registerStaticFieldNode(clazz, group);
            }
        }
        for (let m in clazz.methodsBySignature) {
            let method = clazz.methodsBySignature[m];
            getOrCreateBukkitAbstractMethodNode(clazz.qualifiedName, method.fullSignature);
            getOrCreateBukkitMethodNode(clazz.qualifiedName, method.fullSignature);
        }
        for (let c in clazz.constructorsBySignature) {
            let constructor = clazz.constructorsBySignature[c];
            getOrCreateBukkitConstructorNode(clazz.qualifiedName, constructor.fullSignature);
        }
    }
}

function registerStaticFieldNode(classData: ClassData, fields: FieldData[]) {
    const fieldType = fields[0].type;
    const names = fields.map(field => field.name);
    const type = classData.qualifiedName + "#static:" + fieldType.qualifiedName;

    function BukkitStaticFieldNode(this: BukkitNode) {
        this.nodeType = "BukkitStaticFieldNode";
        this.className = classData.qualifiedName;
        this.color = Colors.ENUM_OFF;
        this.addOutput(names[0], javaType(fieldType), shapeAndColorsForSlotType("enum", {linkType: "staticField"}));
        this.outputs[0].label = "[" + names[0] + "]";
        this.addProperty("field", names[0], "enum", {values: names});
    }

    BukkitStaticFieldNode.title = classData.simpleName + (fieldType.qualifiedName === classData.qualifiedName ? "" : ": " + fieldType.simpleName);
    BukkitStaticFieldNode.prototype.onPropertyChanged = function (this: BukkitNode, property: string, value: string) {
        if (property === "field") this.outputs[0].label = "[" + value + "]";
    };
    LiteGraph.registerNodeType(type, BukkitStaticFieldNode as unknown as LGraphNodeConstructor);
}

function getOrCreateBukkitClassNode(className: string | null | undefined) {
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

    function BukkitClassNode(this: BukkitNode) {
        addClassIO(this, classData!);

        if (this.inputs)
            this.inputs.sort(inputOutputSorter);
        if (this.optional_inputs)
            this.optional_inputs.sort(optionalInputOutputSorter);
        if (this.outputs)
            this.outputs.sort(inputOutputSorter);
        if (this.optional_outputs)
            this.optional_outputs.sort(optionalInputOutputSorter);

        this.nodeType = "BukkitClassNode";

        this.desc = classData!.comment;

        if (classData!.isEvent) {
            this.classType = "event";
            this.iconName = "bullhorn";
            this.color = Colors.EVENT;
            this.addProperty("priority", "NORMAL", "enum", {values: ["LOWEST", "LOW", "NORMAL", "HIGH", "HIGHEST", "MONITOR"]});
            if (classStore.isAssignableTo(classData!.qualifiedName, "org.bukkit.event.Cancellable")) {
                this.addProperty("ignoreCancelled", false, "boolean");
            }
        } else if (classData!.isEnum) {
            this.classType = "enum";
            this.iconName = "list-ol";
            this.color = Colors.ENUM_OFF;//TODO: separate variable
        } else {
            this.classType = "object";
            this.iconName = "box";
            this.color = Colors.OBJECT;
        }

        this.className = classData!.qualifiedName;
        this.isClassNode = true;
    }

    BukkitClassNode.title = simpleClassName;

    BukkitClassNode.prototype.onDrawTitleBox = require("./fontAwesomeHelper").handleDrawTitleBox;

    LiteGraph.registerNodeType(categoryName, BukkitClassNode as unknown as LGraphNodeConstructor);

    return categoryName;
}

function addClassIO(node: BukkitNode, classData: ClassData, isChildCall?: boolean) {
    if (!isChildCall) {
        if (!classData.isEvent && !classData.isEnum && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeInput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
        }
        if (!classData.isEnum && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
            addNodeOutput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
        }
    }

    if (!isChildCall && classData.isObject && classData.qualifiedName !== "org.bukkit.plugin.java.JavaPlugin") {
        addNodeInput(node, "REF", classData.qualifiedName, shapeAndColorsForSlotType("REF", {linkType: "ref"}))
    }
    if (!isChildCall && !classData.isEnum) {
        addNodeOutput(node, "THIS", classData.qualifiedName, shapeAndColorsForSlotType("THIS", {linkType: "this"}))
    }


    if (classData.isEnum && classData.enumConstants.length > 0) {
        let i = addNodeOutput(node, classData.enumConstants[0], classData.qualifiedName, shapeAndColorsForSlotType("enum", {
            linkType: "enum",
            className: classData.qualifiedName,
            enumName: classData.enumConstants[0]
        }));
        node.addProperty("en", classData.enumConstants[0], "enum", {values: classData.enumConstants});
        node.onPropertyChanged = function (this: BukkitNode, property: string, value: string) {
            this.outputs[i!].label = "[" + value + "]";
            this.outputs[i!].enumName = value;
        }
    }

    // for (let f = 0; f < classData.enumConstants.length; f++) {
    //     let en = classData.enumConstants[f];
    //     addNodeOutput(node, en, classData.name, {linkType: "enum", enumData: en, color_off: Colors.ENUM_OFF, color_on: Colors.ENUM_ON});
    // }
    //
    // // TODO: add a separate constructor node-type instead of handling constructor parameters in class nodes
    // if (!classData.isInterface && !classData.isAbstract) {
    //     for (let c = 0; c < classData.constructors.length; c++) {
    //         let constructor = classData.constructors[c];
    //         for (let i = 0; i < constructor.parameters.length; i++) {
    //             let param = constructor.parameters[i];
    //             addNodeInput(node, param.name, param.type.qualifiedName, shapeAndColorsForSlotType(param.type.qualifiedName, {
    //                 linkType: "constructorParam",
    //                 constructorName: constructor.name,
    //                 paramType: param.type.qualifiedName,
    //                 paramName: param.name,
    //                 paramIndex: i
    //             }), true)
    //         }
    //     }
    // }


    for (let m in classData.methodsBySignature) {
        let method = classData.methodsBySignature[m];

        let methodSignature = method.fullSignature;


        if (method.returnType.qualifiedName === "void") {// Regular void or abstract Method
            addNodeOutput(node, method.fullFlatSignature, classData.qualifiedName + "#" + methodSignature, shapeAndColorsForSlotType(method.isStatic ? "staticMethod" : "method", {
                linkType: method.isStatic ? "staticMethod" : "method",
                className: classData.qualifiedName,
                methodName: method.name,
                methodSignature: method.fullSignature
            }), true);
        } else if (method.parameters.length === 0) {// non-void method without parameters
            let returnData = classStore.getClass(method.returnType.qualifiedName);

            let linkType = "";
            let extraDataType = "";
            if (isPrimitiveType(method.returnType.qualifiedName) || method.returnType.qualifiedName === "java.lang.String") {// use getter
                linkType = "getter";
                extraDataType = method.returnType.qualifiedName;
            } else if (returnData && returnData.isObject) {// Object return
                linkType = extraDataType = "object";
            } else if (returnData && returnData.isEnum) {// Enum return
                linkType = extraDataType = "enum";
            } else {// fallback to abstract/regular method
                linkType = extraDataType = method.isStatic ? "staticMethod" : "method";
            }

            // add it!
            addNodeOutput(node, method.name, javaType(method.returnType), shapeAndColorsForSlotType(extraDataType, {
                linkType: linkType,
                returnType: method.returnType.qualifiedName,
                className: classData.qualifiedName,
                methodName: method.name,
                methodSignature: method.fullSignature
            }), true);
        } else {// fallback to abstract/regular method
            addNodeOutput(node, method.fullFlatSignature, classData.qualifiedName + "#" + methodSignature, shapeAndColorsForSlotType(method.isStatic ? "staticMethod" : "method", {
                linkType: method.isStatic ? "staticMethod" : "method",
                className: classData.qualifiedName,
                methodName: method.name,
                methodSignature: method.fullSignature
            }), true);
        }

    }

    // Interfaces
    if (classData.interfaces) {
        for (let i = 0; i < classData.interfaces.length; i++) {
            let interfaceData = classStore.getClass(classData.interfaces[i]);
            if (interfaceData) {
                addClassIO(node, interfaceData, true);
            } else {
                console.warn("Missing class data for interface class " + classData.interfaces[i]);
            }
        }
    }
    // Superclass
    if (classData.superclass && classData.superclass.length > 0 && classData.superclass !== "java.lang.Object" && classData.superclass !== "java.lang.Enum") {
        console.log(classData.superclass);
        let superData = classStore.getClass(classData.superclass);
        if (superData) {
            addClassIO(node, superData, true);
        } else {
            console.warn("Missing class data for superclass " + classData.superclass);
        }
    }
}

function getOrCreateBukkitMethodNode(className: string | null | undefined, methodSignature: string | null | undefined) {

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

    function BukkitMethodNode(this: BukkitNode) {
        addMethodIO(this, classData!, methodData!);
        this.nodeType = "BukkitMethodNode";
        this.iconName = "hashtag";
        this.className = classData!.qualifiedName;
        this.methodName = methodData!.name;
        this.methodSignature = methodData!.fullSignature;
        this.isMethodNode = true;

        this.desc = methodData!.comment;
    }

    BukkitMethodNode.title = simpleClassName + (methodData.isStatic ? "." : "#") + methodData.fullFlatSignature;

    BukkitMethodNode.prototype.color = methodData.isStatic ? Colors.STATIC_FUNCTION_OFF : Colors.FUNCTION;
    BukkitMethodNode.prototype.onDrawTitleBox = require("./fontAwesomeHelper").handleDrawTitleBox;


    LiteGraph.registerNodeType(categoryName, BukkitMethodNode as unknown as LGraphNodeConstructor);

    return categoryName;
}

function addMethodIO(node: BukkitNode, classData: ClassData, methodData: MethodData) {

    let methodSignature = methodData.fullSignature;


    if (!(classData.qualifiedName === "org.bukkit.plugin.java.JavaPlugin" && (methodData.name === "onEnable" || methodData.name === "onDisable" || methodData.name === "onCommand" || methodData.name === "onTabComplete")))
        addNodeInput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    addNodeOutput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));


    addNodeInput(node, "REF", classData.qualifiedName + "#" + methodSignature, shapeAndColorsForSlotType(methodData.isStatic ? "staticMethod" : "method"));
    for (let p = 0; p < methodData.parameters.length; p++) {
        let param = methodData.parameters[p];
        addNodeInput(node, param.name, javaType(param.type), shapeAndColorsForSlotType(param.type.qualifiedName, {
            paramName: param.name,
            paramType: param.type.qualifiedName,
            paramIndex: p
        }));
    }

    if (methodData.returnType.qualifiedName !== "void") {
        addNodeOutput(node, "RETURN", javaType(methodData.returnType), shapeAndColorsForSlotType(methodData.returnType.qualifiedName, {returnType: methodData.returnType.qualifiedName}));
    }
}


function getOrCreateBukkitAbstractMethodNode(className: string | null | undefined, methodSignature: string | null | undefined) {

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

    let categoryName = className + "{" + methodSignature + "}";

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitAbstractMethodNode(this: BukkitNode) {
        addAbstractMethodIO(this, classData!, methodData!);
        this.nodeType = "BukkitAbstractMethodNode";
        this.iconName = "sitemap";
        this.className = classData!.qualifiedName;
        this.methodName = methodData!.name;
        this.methodSignature = methodData!.fullSignature;
        this.isAbstractMethod = true;
        this.isAbstractMethodNode = true;

        this.desc = methodData!.comment;
    }

    BukkitAbstractMethodNode.title = simpleClassName + "{" + methodData.fullFlatSignature + "}";

    BukkitAbstractMethodNode.prototype.color = Colors.ABSTRACT_FUNCTION_OFF;
    BukkitAbstractMethodNode.prototype.onDrawTitleBox = require("./fontAwesomeHelper").handleDrawTitleBox;


    LiteGraph.registerNodeType(categoryName, BukkitAbstractMethodNode as unknown as LGraphNodeConstructor);

    return categoryName;
}

function addAbstractMethodIO(node: BukkitNode, classData: ClassData, methodData: MethodData) {
    let methodSignature = methodData.fullSignature;

    addNodeOutput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    addNodeInput(node, "REF", classData.qualifiedName + "#" + methodSignature, shapeAndColorsForSlotType("abstractMethod"));
    for (let p = 0; p < methodData.parameters.length; p++) {
        let param = methodData.parameters[p];
        let paramType = javaType(param.type);

        addNodeOutput(node, param.name, paramType, shapeAndColorsForSlotType(paramType, {
            paramName: param.name,
            paramType: param.type.qualifiedName,
            paramIndex: p
        }));
    }

    if (methodData.returnType.qualifiedName !== "void") {
        addNodeInput(node, "RETURN", javaType(methodData.returnType), shapeAndColorsForSlotType(methodData.returnType.qualifiedName, {returnType: methodData.returnType.qualifiedName}));
    }
}

function getOrCreateBukkitConstructorNode(className: string | null | undefined, constructorSignature: string | null | undefined) {

    let classData = classStore.getClass(className);
    if (!classData) {
        console.warn("Class " + className + " does not exist or isn't loaded");
        return null;
    }
    let constructorData = classStore.getConstructor(className, constructorSignature);
    if (!constructorData) {
        console.warn("Missing constructor data for " + constructorSignature + " in " + className);
        return null;
    }

    let categoryName = className + "#" + constructorSignature;

    if (LiteGraph.registered_node_types.hasOwnProperty(categoryName)) {
        return categoryName;
    }

    function BukkitConstructorNode(this: BukkitNode) {
        addConstructorIO(this, classData!, constructorData!);
        this.nodeType = "BukkitConstructorNode";
        this.iconName = "plus-square";
        this.className = classData!.qualifiedName;
        this.constructorName = constructorData!.name;
        this.constructorSignature = constructorData!.fullSignature;
        this.isConstructorNode = true;

        this.desc = constructorData!.comment;
    }

    BukkitConstructorNode.title = constructorData.fullFlatSignature;

    BukkitConstructorNode.prototype.color = Colors.CONSTRUCTOR;
    BukkitConstructorNode.prototype.onDrawTitleBox = require("./fontAwesomeHelper").handleDrawTitleBox;


    LiteGraph.registerNodeType(categoryName, BukkitConstructorNode as unknown as LGraphNodeConstructor);

    return categoryName;
}

function addConstructorIO(node: BukkitNode, classData: ClassData, constructorData: ConstructorData) {
    addNodeInput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    addNodeOutput(node, "EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));

    addNodeOutput(node, "THIS", classData.qualifiedName, shapeAndColorsForSlotType("THIS", {linkType: "this"}));

    if (!classData.isInterface) {
        for (let i = 0; i < constructorData.parameters.length; i++) {
            let param = constructorData.parameters[i];
            addNodeInput(node, param.name, param.type.qualifiedName, shapeAndColorsForSlotType(param.type.qualifiedName, {
                linkType: "constructorParam",
                constructorName: globalThis.constructor.name,
                paramType: param.type.qualifiedName,
                paramName: param.name,
                paramIndex: i
            }))
        }
    }

    for (let m in classData.methodsBySignature) {
        let method = classData.methodsBySignature[m];

        let methodSignature = method.fullSignature;

        let isLambda = checkLambdaOrAbstractMethod(classData, method);

        if (!method.isStatic) {
            addNodeOutput(node, method.fullFlatSignature, classData.qualifiedName + "#" + methodSignature, shapeAndColorsForSlotType("abstractMethod", {
                linkType: "abstractMethod",
                className: classData.qualifiedName,
                methodName: method.name,
                methodSignature: method.fullSignature
            }), !isLambda);
        }
    }


}

function checkLambdaOrAbstractMethod(classData: ClassData, methodData: MethodData) {
    return (classData.methods.length === 1 || countNonDefaultMethods(classData) === 1) && classData.isInterface || methodData.isAbstract
}

function countNonDefaultMethods(classData: ClassData) {
    let c = 0;
    for (let m = 0; m < classData.methods.length; m++) {
        if (!classData.methods[m].isDefault) c++;
    }
    return c;
}

function addNodeInput(node: LGraphNode, name: string, type: string, options?: Partial<INodeSlot>, optional?: boolean) {
    if (!node.optional_inputs) node.optional_inputs = [];
    if (!node.inputs) node.inputs = [];
    if (optional) {
        for (let s = 0; s < node.optional_inputs.length; s++) {
            if (node.optional_inputs[s]![0] === name) {
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

    if (type && type !== "java.lang.Object") {
        let implementingAndExtending = classStore.getAllImplementingAndExtendingClasses(type);
        console.log(implementingAndExtending);
        if (implementingAndExtending.length > 0) {
            type = implementingAndExtending.join(",");
        }
    }

    if (optional) {
        options.removable = true;
        node.optional_inputs.push([name, type, options]);
    } else {
        node.addInput(name, type, options);
    }
    return node.inputs.length - 1;
}

function addNodeOutput(node: LGraphNode, name: string, type: string, options?: Partial<INodeSlot>, optional?: boolean) {
    if (!node.optional_outputs) node.optional_outputs = [];
    if (!node.outputs) node.outputs = [];
    if (optional) {
        for (let s = 0; s < node.optional_outputs.length; s++) {
            if (node.optional_outputs[s]![0] === name) {
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
    if (optional) {
        options.removable = true;
        node.optional_outputs.push([name, type, options]);
    } else {
        node.addOutput(name, type, options);
    }
    return node.outputs.length - 1;
}

function handleSlotDoubleClick(node: BukkitNode, type: "in" | "out", i: number, e: CanvasMouseEvent) {
    console.log("handleSlotDoubleClick", type, i);
    let slot = (type === "in" ? node.getInputInfo(i) : node.getOutputInfo(i)) as INodeSlot & {type: string};
    console.log(slot);

    let nodeName;
    let offsetX = 0;
    let offsetY = 0;
    if (type === "out") {
        offsetX = 40;
        offsetY = -10;
        if (slot.name === "RETURN" || slot.hasOwnProperty("returnType")) {
            nodeName = getOrCreateBukkitClassNode(slot.returnType);
        } else if (slot.type.indexOf("#") !== -1) {
            if (node.isConstructorNode || (slot.className === "org.bukkit.plugin.java.JavaPlugin" && (slot.methodName === "onLoad" || slot.methodName === "onEnable" || slot.methodName === "onDisable" || slot.methodName === "onCommand" || slot.methodName === "onTabComplete"))) {// abstract method
                nodeName = getOrCreateBukkitAbstractMethodNode(slot.className, slot.methodSignature);
            } else {// regular method
                nodeName = getOrCreateBukkitMethodNode(slot.className, slot.methodSignature);
            }
        } else /*if (slot.type.startsWith("org.bukkit") && classesByName.hasOwnProperty(slot.type))*/ {
            nodeName = getOrCreateBukkitClassNode(slot.className || slot.type);
        }
    } else if (type === "in") {
        offsetX = -(40 + node.size[0]);
        offsetY = 10;
        if (slot.linkType === "ref" && slot.hasOwnProperty("type")) {
            let nameSplit = node.className.split(".");
            let simpleName = nameSplit[nameSplit.length - 1];
            nodeName = getOrCreateBukkitConstructorNode(node.className, simpleName + "()");
        } else if (slot.type === "boolean") {
            nodeName = "constants/BooleanConstant";
        } else if (slot.type === "string" || slot.type === "java.lang.String") {
            nodeName = "constants/StringConstant";
        } else if (slot.type === "char") {
            nodeName = "constants/CharConstant";
        } else if (isNumberType(slot.type)) {
            nodeName = "constants/NumberConstant";
        }
    }
    if (nodeName) {
        console.log(nodeName);
        var n = LiteGraph.createNode(nodeName!);
        n.pos = [e.canvasX + offsetX, e.canvasY + offsetY];
        canvas.graph!.add(n);

        console.log(n);

        if (type === "out" && n.inputs) {
            const ref = n.findInputSlot("REF");
            if (ref >= 0) node.connect(i, n, ref);
            const execOut = node.findOutputSlot("EXEC");
            const execIn = n.findInputSlot("EXEC");
            if (execOut >= 0 && execIn >= 0) node.connect(execOut, n, execIn);
        }
        if (type === "in" && n.outputs) {
            if (nodeName === "constants/NumberConstant") {
                n.properties["type"] = slot.type;
            }
            setTimeout(function () {
                if (nodeName!.startsWith("constants/")) {// constants don't have EXEC/THIS
                    n.connect(0, node, i);
                } else {
                    n.connect(0, node, 0);// 0 = EXEC
                    n.connect(1, node, i);// 1 = THIS
                }
            }, 10);// No idea why, but this seems to need a timeout to connect stuff properly
        }
    }
}

export {init, getOrCreateBukkitClassNode, getOrCreateBukkitMethodNode};
