import type {ITextWidget} from "../../../assets/lib/litegraph/litegraph";
import type {NativeNode, NodeModule} from "../../types/nodes";

function Note(this: NativeNode) {
    this.classType = "native";
    this.addProperty("text", "", "string");
    const text = this.addWidget<ITextWidget>("text", "text", "", undefined, {property: "text", multiline: true});
    this.onPropertyChanged = function (this: NativeNode) {
        text.value = this.properties.text || "";
        this.setDirtyCanvas(true, true);
    };
    this.size = [240, 120];
    this.resizable = true;
    this.clip_area = true;
}

Note.title = "Note";
Note.prototype.color = "#555";
Note.prototype.bgcolor = "#333";
Note.prototype.onConfigure = function (this: NativeNode) {
    this.setDirtyCanvas(true, true);
};
Note.prototype.onDrawBackground = function (this: NativeNode, ctx: CanvasRenderingContext2D) {
    if (this.flags.collapsed) return;
    ctx.save();
    ctx.font = "14px Arial";
    ctx.fillStyle = "#BBB";
    let y = 50;
    for (const paragraph of (this.properties.text || "").split("\n")) {
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
