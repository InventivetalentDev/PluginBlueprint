import {isPrimitiveType, shapeAndColorsForSlotType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {isJavaIdentifier, isJavaTypeName, sourceProperty, sourceType} from "../sourceChecks";
import type {CodeSlot, NativeNode, NodeModule} from "../../types/nodes";
import type {ContextMenuItem, LGraphCanvas, Vector2} from "../../../assets/lib/litegraph/litegraph";

interface CodeCanvas extends LGraphCanvas {
    prompt(title: string, value: string | undefined, callback: (value: string) => void, event: MouseEvent, multiline?: boolean): HTMLDivElement;
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

function addSlot(node: NativeNode, canvas: LGraphCanvas, event: MouseEvent, input: boolean): void {
    canvas.prompt(input ? "Input name" : "Output name", "", (name: string) => {
        if (!isJavaIdentifier(name) || [...node.properties.codeInputs!, ...node.properties.codeOutputs!].some(slot => slot.name === name)) return;
        const add = (type: string) => {
            if (!isJavaTypeName(type) || [...node.properties.codeInputs!, ...node.properties.codeOutputs!].some(slot => slot.name === name)) return;
            const property = input ? "codeInputs" : "codeOutputs";
            node.graph?.beforeChange(node);
            node.properties[property] = [...node.properties[property]!, {name, type}];
            const options = shapeAndColorsForSlotType(type, {removable: true, nameLocked: true});
            if (input) node.addInput(name, type, options);
            else node.addOutput(name, type, options);
            node.graph?.afterChange(node);
        };
        new LiteGraph.ContextMenu([
            ...slotTypes.map(type => ({content: type, callback: () => add(type)})),
            {content: "Other…", callback: (value, options, typeEvent) => { canvas.prompt("Java type", "", add, typeEvent); }}
        ], {event, title: "Java type"});
    }, event);
}

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
JavaCode.prototype.getMenuOptions = function (this: NativeNode, canvas: CodeCanvas): ContextMenuItem[] {
    return [
        {content: "Edit code…", callback: (value, options, event) => editCode(this, canvas, event)},
        {content: "Add input…", callback: (value, options, event) => addSlot(this, canvas, event, true)},
        {content: "Add output…", callback: (value, options, event) => addSlot(this, canvas, event, false)}
    ];
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
