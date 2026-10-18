import type {LGraphCanvas, Vector2} from "../../../assets/lib/litegraph/litegraph";
import type {NativeNode, NodeModule} from "../../types/nodes";

interface NoteNode extends NativeNode {
    configuredOrResized?: boolean;
}

interface NoteCanvas extends LGraphCanvas {
    prompt(title: string, value: string | undefined, callback: (value: string) => void, event: MouseEvent, multiline?: boolean): HTMLDivElement;
}

function Note(this: NoteNode) {
    this.classType = "native";
    this.addProperty("text", "", "string");
    this.configuredOrResized = false;
    this.size = [240, 120];
    this.resizable = true;
}

Note.title = "Note";
Note.prototype.color = "#555";
Note.prototype.bgcolor = "#333";
Note.prototype.computeSize = function (this: NoteNode): Vector2 {
    return this.configuredOrResized ? [140, 60] : [240, 120];
};
Note.prototype.onConfigure = function (this: NoteNode) {
    this.configuredOrResized = true;
    this.setDirtyCanvas(true, true);
};
Note.prototype.onResize = function (this: NoteNode) {
    this.configuredOrResized = true;
};
Note.prototype.onPropertyChanged = function (this: NativeNode) {
    this.setDirtyCanvas(true, true);
};
Note.prototype.onDblClick = function (this: NativeNode, event: MouseEvent, pos: Vector2, canvas: NoteCanvas) {
    if (pos[1] < 0) return;
    canvas.prompt("Note", this.properties.text, (text: string) => {
        if (text === this.properties.text) return;
        this.setProperty("text", text);
        this.graph?.onNodePropertyChanged?.(this, "text", text);
    }, event, true);
};
Note.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D) {
    if (this.flags.collapsed) return;
    ctx.save();
    // Node-wide clipping hides the title above the body, so clip only the text.
    ctx.beginPath();
    ctx.rect(0, 0, this.size[0], this.size[1]);
    ctx.clip();
    ctx.font = "14px Arial";
    ctx.fillStyle = this.properties.text ? "#BBB" : "#888";
    let y = 20;
    for (const paragraph of (this.properties.text || "Double-click to edit").split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
            const next = line ? line + " " + word : word;
            if (line && ctx.measureText(next).width > this.size[0] - 20) {
                ctx.fillText(line, 10, y);
                y += 18;
                line = word;
            } else {
                line = next;
            }
        }
        ctx.fillText(line, 10, y);
        y += 18;
    }
    ctx.restore();
};

export = [Note] satisfies NodeModule;
