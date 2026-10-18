import {shapeAndColorsForSlotType} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import type {NativeNode, NodeModule} from "../../types/nodes";

function CancelEvent(this: NativeNode) {
    this.classType = "native";
    this.iconName = "ban";
    this.addInput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addOutput("EXEC", "@EXEC", shapeAndColorsForSlotType("@EXEC"));
    this.addInput("event", "org.bukkit.event.Cancellable", shapeAndColorsForSlotType("object"));
    this.addProperty("cancel", true, "boolean");
}

CancelEvent.title = "Cancel event";
CancelEvent.prototype.getMethodBody = function (this: NativeNode, input: (string | null)[]): string {
    return input[1] ? input[1] + ".setCancelled(" + this.properties.cancel + ");" : "";
};
CancelEvent.prototype.getExecAfter = function (this: NativeNode, exec: string[][]): string {
    return exec[0].join("\n");
};
CancelEvent.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [CancelEvent] satisfies NodeModule;
