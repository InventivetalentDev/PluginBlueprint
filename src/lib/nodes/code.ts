import {isPrimitiveType, shapeAndColorsForSlotType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {isJavaIdentifier, isJavaTypeName, sourceProperty, sourceType} from "../sourceChecks";
import {openPicker, type PickerItem} from "../picker";
import {classStore} from "../graphValidator";
import type {CodeSlot, NativeNode, NodeModule} from "../../types/nodes";
import {LGraphCanvas, LGraphNode, type ContextMenuItem, type INodeInputSlot, type INodeOutputSlot, type INodeSlot, type Vector2} from "../../../assets/lib/litegraph/litegraph";

interface CodeCanvas extends LGraphCanvas {
    prompt(title: string, value: string | undefined, callback: (value: string) => void, event: MouseEvent, multiline?: boolean): HTMLDivElement;
}

interface CodeNode extends NativeNode {
    addCodeSlot(input: boolean, name: string, type: string): number;
    addSlotForLink(input: boolean, slot: INodeSlot | undefined, other: LGraphNode): number;
    renameCodeSlot(input: boolean, index: number, name: string): boolean;
}

const slotTypes = [
    "java.lang.String", "int", "double", "boolean", "long", "java.lang.Object",
    "org.bukkit.entity.Player", "org.bukkit.command.CommandSender", "org.bukkit.Location",
    "org.bukkit.World", "org.bukkit.inventory.ItemStack"
];

function editCode(node: NativeNode, canvas: CodeCanvas, event: MouseEvent): void {
    canvas.prompt("Java code", node.properties.code, (text: string) => {
        if (text === node.properties.code) return;
        node.setProperty("code", text);
        node.graph?.onNodePropertyChanged?.(node, "code", text);
    }, event, true);
}

function slotNames(node: NativeNode): string[] {
    return [...node.properties.codeInputs!, ...node.properties.codeOutputs!].map(slot => slot.name);
}

// A free variable name for a slot made from another node's slot: getPlayer → player, THIS of a Player → player.
function codeSlotName(node: NativeNode, name: string, type: string): string {
    let base = name.replace(/\(.*$/, "").replace(/^get(?=[A-Z])/, "");
    if (["EXEC", "REF", "THIS", "RETURN"].includes(base) || !isJavaIdentifier(base)) base = type.replace(/(?:\[\])+$/, "").split(".").pop()!;
    base = /^[A-Z0-9_]+$/.test(base) ? base.toLowerCase() : base.charAt(0).toLowerCase() + base.slice(1);
    if (!isJavaIdentifier(base)) base = "value";
    const taken = slotNames(node);
    let candidate = base;
    for (let i = 2; taken.includes(candidate); i++) candidate = base + i;
    return candidate;
}

// The Java type a slot for a dropped link gets, or null. Method inputs list the
// declared type first, then every subtype; REF slots hold "Class#method" keys.
function linkSlotType(type: unknown): string | null {
    if (typeof type !== "string" || type === "@EXEC" || type.includes("#")) return null;
    const first = type.split(",")[0];
    return isJavaTypeName(first) ? first : null;
}

let typeList: (PickerItem & {name: string; text: string})[] | undefined;
function searchTypes(query: string): PickerItem[] {
    typeList ||= [...new Set([...slotTypes, ...Object.values(classStore.getClassesByName())
        .filter(clazz => !clazz.isDeprecated).map(clazz => clazz.qualifiedName).sort((a, b) => a.split(".").pop()!.localeCompare(b.split(".").pop()!))])]
        .map(type => {
            const name = type.split(".").pop()!;
            return {
                value: type, label: name, detail: type.slice(0, -name.length - 1) || undefined,
                group: slotTypes.includes(type) ? "Common" : "All classes", name: name.toLowerCase(), text: type.toLowerCase()
            };
        });
    if (!query) return typeList;
    const words = query.toLowerCase().split(/\s+/);
    const inName = (item: {name: string}) => words.every(word => item.name.includes(word));
    const matches: PickerItem[] = typeList.filter(item => words.every(word => item.text.includes(word)))
        .sort((a, b) => Number(inName(b)) - Number(inName(a)));
    if (isJavaTypeName(query) && !typeList.some(item => item.value === query || item.name === query.toLowerCase())) {
        matches.unshift({value: query, label: query, detail: "Use this type"});
    }
    return matches;
}

function addSlot(node: CodeNode, canvas: CodeCanvas, event: MouseEvent, input: boolean): void {
    openPicker({
        x: event.clientX, y: event.clientY,
        placeholder: input ? "Input type" : "Output type",
        search: searchTypes,
        onPick: type => canvas.prompt(input ? "Input name" : "Output name", codeSlotName(node, "", type),
            (name: string) => node.addCodeSlot(input, name, type), event)
    });
}

// The canvas calls connectByType when a link is dropped on a node's body
// instead of on a slot. Code nodes add a slot for the link.
const connectByType = LGraphNode.prototype.connectByType;
LGraphNode.prototype.connectByType = function (this: LGraphNode, slot, target, type, options) {
    const index = target !== this ? (target as Partial<CodeNode>).addSlotForLink?.(true, this.outputs[typeof slot === "number" ? slot : this.findOutputSlot(slot)], this) ?? -1 : -1;
    return index >= 0 ? this.connect(slot, target, index) : connectByType.call(this, slot, target, type, options);
};
const connectByTypeOutput = LGraphNode.prototype.connectByTypeOutput;
LGraphNode.prototype.connectByTypeOutput = function (this: LGraphNode, slot, source, type, options) {
    const index = source !== this ? (source as Partial<CodeNode>).addSlotForLink?.(false, this.inputs[typeof slot === "number" ? slot : this.findInputSlot(slot)], this) ?? -1 : -1;
    return index >= 0 ? source.connect(index, this, slot) : connectByTypeOutput.call(this, slot, source, type, options);
};

function JavaCode(this: NativeNode) {
    this.classType = "native";
    this.iconName = "code";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addProperty("code", "// Inputs and outputs are local variables with the names you gave them.\n", "string");
    this.properties.codeInputs = [];
    this.properties.codeOutputs = [];
    this.size = [300, 120];
}

JavaCode.title = "Java code";
JavaCode.slot_start_y = 84;
JavaCode.prototype.color = "#a52626";
JavaCode.prototype.bgcolor = "#381818";
JavaCode.prototype.onDblClick = function (this: NativeNode, event: MouseEvent, pos: Vector2, canvas: CodeCanvas): void {
    editCode(this, canvas, event);
};
JavaCode.prototype.getMenuOptions = function (this: CodeNode, canvas: CodeCanvas): ContextMenuItem[] {
    return [
        {content: "Edit code…", callback: (value, options, event) => editCode(this, canvas, event)},
        {content: "Add input…", callback: (value, options, event) => addSlot(this, canvas, event, true)},
        {content: "Add output…", callback: (value, options, event) => addSlot(this, canvas, event, false)}
    ];
};
JavaCode.prototype.getSlotMenuOptions = function (this: CodeNode, info: {input?: INodeInputSlot; output?: INodeOutputSlot; slot: number}): ContextMenuItem[] {
    const slot = info.input || info.output;
    const options: ContextMenuItem[] = [];
    if (info.output?.links?.length) options.push({content: "Disconnect Links", slot: info} as ContextMenuItem);
    if (slot?.removable) options.push({content: "Remove Slot", slot: info} as ContextMenuItem);
    if (slot && info.slot > 0) {
        options.push({
            content: "Rename…", callback: (value, menuOptions, event) => {
                (LGraphCanvas.active_canvas as unknown as CodeCanvas).prompt(info.input ? "Input name" : "Output name", slot.name,
                    (name: string) => this.renameCodeSlot(!!info.input, info.slot, name), event);
            }
        });
    }
    return options;
};
JavaCode.prototype.addCodeSlot = function (this: CodeNode, input: boolean, name: string, type: string): number {
    if (!isJavaIdentifier(name) || !isJavaTypeName(type) || slotNames(this).includes(name)) return -1;
    const property = input ? "codeInputs" : "codeOutputs";
    this.graph?.beforeChange(this);
    this.properties[property] = [...this.properties[property]!, {name, type}];
    const options = shapeAndColorsForSlotType(type, {removable: true, nameLocked: true});
    if (input) this.addInput(name, type, options);
    else this.addOutput(name, type, options);
    this.graph?.afterChange(this);
    return (input ? this.inputs : this.outputs).length - 1;
};
JavaCode.prototype.addSlotForLink = function (this: CodeNode, input: boolean, slot: INodeSlot | undefined, other: LGraphNode): number {
    const type = linkSlotType(slot?.type);
    if (!slot || !type) return -1;
    const existing = (input ? this.inputs : this.outputs).findIndex((own, index) => index > 0 && own.type === type && (!input || (own as INodeInputSlot).link == null));
    if (existing !== -1) return existing;
    const signature = (other as LGraphNode & {methodSignature?: unknown}).methodSignature;
    const name = slot.name === "RETURN" && typeof signature === "string" ? signature : slot.name;
    return this.addCodeSlot(input, codeSlotName(this, name, type), type);
};
JavaCode.prototype.renameCodeSlot = function (this: CodeNode, input: boolean, index: number, name: string): boolean {
    const property = input ? "codeInputs" : "codeOutputs";
    const old = this.properties[property]![index - 1];
    if (!old || !isJavaIdentifier(name) || slotNames(this).includes(name)) return false;
    this.graph?.beforeChange(this);
    this.properties[property] = this.properties[property]!.map((slot, i) => i === index - 1 ? {name, type: slot.type} : slot);
    Object.assign((input ? this.inputs : this.outputs)[index], {name, label: name});
    // Rename the variable where the code uses it, but not members such as other.player
    const usage = new RegExp(`(?<![\\p{L}\\p{N}_$.])${old.name.replace(/\$/g, "\\$")}(?![\\p{L}\\p{N}_$])`, "gu");
    if (typeof this.properties.code === "string") this.properties.code = this.properties.code.replace(usage, () => name);
    this.graph?.afterChange(this);
    this.setDirtyCanvas(true, true);
    return true;
};
JavaCode.prototype.onInputRemoved = function (this: NativeNode, slot: number): void {
    if (slot > 0) {
        this.properties.codeInputs?.splice(slot - 1, 1);
        this.graph?.afterChange(this);
    }
};
JavaCode.prototype.onOutputRemoved = function (this: NativeNode, slot: number): void {
    if (slot > 0) {
        this.properties.codeOutputs?.splice(slot - 1, 1);
        this.graph?.afterChange(this);
    }
};
JavaCode.prototype.onConfigure = function (this: NativeNode): void {
    for (const input of [true, false]) {
        const declared = input ? this.properties.codeInputs : this.properties.codeOutputs;
        if (!Array.isArray(declared) || declared.some(slot => !slot || typeof slot.name !== "string" || typeof slot.type !== "string")) continue;
        const slots = input ? this.inputs : this.outputs;
        const entries: CodeSlot[] = [{name: "EXEC", type: "@EXEC"}, ...declared];
        entries.forEach(({name, type}, index) => {
            const options = shapeAndColorsForSlotType(type, {removable: index > 0, nameLocked: true});
            if (slots[index]) {
                Object.assign(slots[index], {name, label: name, type, shape: undefined, color_on: undefined, color_off: undefined}, options);
            } else if (input) this.addInput(name, type, options);
            else this.addOutput(name, type, options);
        });
        while (slots.length > entries.length) {
            if (input) this.removeInput(slots.length - 1);
            else this.removeOutput(slots.length - 1);
        }
    }
    this.size = this.computeSize();
    this.setDirtyCanvas(true, true);
};
JavaCode.prototype.onPropertyChanged = function (this: NativeNode): void {
    this.setDirtyCanvas(true, true);
};
JavaCode.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D): void {
    if (this.flags.collapsed) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.size[0], this.size[1]);
    ctx.clip();
    ctx.font = "12px monospace";
    ctx.fillStyle = "#ddd";
    if (typeof this.properties.code === "string") {
        this.properties.code.split("\n").slice(0, 4).forEach((line, index) => ctx.fillText(line, 10, 18 + index * 18));
    }
    ctx.restore();
};
JavaCode.prototype.onDrawForeground = function (this: NativeNode, ctx: CanvasRenderingContext2D, canvas: LGraphCanvas & {connecting_output?: INodeSlot; connecting_input?: INodeSlot}): void {
    const slot = canvas.connecting_output || canvas.connecting_input;
    if (this.flags.collapsed || !canvas.connecting_node || canvas.connecting_node === this || !linkSlotType(slot?.type)) return;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#ddd";
    ctx.strokeRect(2, 2, this.size[0] - 4, this.size[1] - 4);
    ctx.font = "14px Arial";
    ctx.fillStyle = "#ddd";
    ctx.textAlign = "center";
    ctx.fillText(canvas.connecting_output ? "+ input" : "+ output", this.size[0] / 2, this.size[1] - 10);
    ctx.restore();
};
JavaCode.prototype.getFields = function (this: NativeNode, output: string[]): string[] {
    sourceProperty(this, "codeInputs");
    sourceProperty(this, "codeOutputs");
    sourceProperty(this, "code");
    return this.properties.codeOutputs!.map((slot, index) => sourceType(this, slot.type) + " " + output[index + 1]);
};
JavaCode.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[], output: string[]): string {
    sourceProperty(this, "codeInputs");
    sourceProperty(this, "codeOutputs");
    sourceProperty(this, "code");
    const defaultValue = (type: string) => type === "boolean" ? "false" : isPrimitiveType(type) ? "0" : "null";
    return [
        "{",
        ...this.properties.codeInputs!.map((slot, index) => "final " + sourceType(this, slot.type) + " " + slot.name + " = " + (input[index + 1] ?? defaultValue(slot.type)) + ";"),
        ...this.properties.codeOutputs!.map(slot => sourceType(this, slot.type) + " " + slot.name + " = " + defaultValue(slot.type) + ";"),
        this.properties.code!,
        ...this.properties.codeOutputs!.map((slot, index) => output[index + 1] + " = " + slot.name + ";"),
        "}"
    ].join("\n");
};
JavaCode.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    sourceProperty(this, "codeInputs");
    sourceProperty(this, "codeOutputs");
    sourceProperty(this, "code");
    return exec[0].join("\n");
};
JavaCode.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [JavaCode] satisfies NodeModule;
