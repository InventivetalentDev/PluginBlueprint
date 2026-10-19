import {LGraph, LGraphNode, LGraphCanvas, LiteGraph, type SerializedLGraphNode, type LLink, type Vector2} from "../../../assets/lib/litegraph/litegraph";
import {shapeAndColorsForSlotType, updateLinkColors} from "../util";
import {handleDrawTitleBox} from "../fontAwesomeHelper";
import {SUBGRAPH_INPUT, SUBGRAPH_OUTPUT} from "../subgraphs";
import type {NativeNode, NodeModule, SubgraphNode} from "../../types/nodes";
import type {LiteGraphExtras} from "../../types/litegraph-augment";

function Subgraph(this: NativeNode) {
    this.iconName = "project-diagram";
    this.inputs = [];
    this.outputs = [];
    this.subgraph = new LGraph();
    this.subgraph._subgraph_node = this as unknown as SubgraphNode;
    (this.subgraph.config as {align_to_grid?: boolean}).align_to_grid = (this.graph?.config as {align_to_grid?: boolean} | undefined)?.align_to_grid;
    for (const hook of ["onNodeAdded", "onNodeRemoved", "onConnectionChange", "onNodePropertyChanged", "onAfterChange", "onGetNodeMenuOptions"] as const) {
        this.subgraph[hook] = (...args: unknown[]) => (this.graph?.[hook] as ((...args: unknown[]) => void) | undefined)?.(...args);
    }
}
Subgraph.title = "Subgraph";
Subgraph.prototype.configure = function (this: SubgraphNode, info: SerializedLGraphNode): void {
    this._syncPaused = true;
    try {
        LGraphNode.prototype.configure.call(this, info);
        (this.subgraph.config as {align_to_grid?: boolean}).align_to_grid = (this.graph?.config as {align_to_grid?: boolean} | undefined)?.align_to_grid;
    } finally {
        this._syncPaused = false;
    }
};
Subgraph.prototype.onAdded = function (this: SubgraphNode): void {
    (this.subgraph.config as {align_to_grid?: boolean}).align_to_grid = (this.graph?.config as {align_to_grid?: boolean} | undefined)?.align_to_grid;
};
Subgraph.prototype.onSerialize = function (this: SubgraphNode, data: SerializedLGraphNode & {subgraph?: object}): void {
    data.subgraph = this.subgraph.serialize();
};
Subgraph.prototype.onDblClick = function (this: SubgraphNode, event: MouseEvent, pos: Vector2, canvas: LGraphCanvas): void {
    canvas.openSubgraph(this.subgraph);
};
Subgraph.prototype.getMenuOptions = function (this: SubgraphNode, canvas: LGraphCanvas) {
    return [
        {content: "Open subgraph", callback: () => canvas.openSubgraph(this.subgraph)},
        {content: "Rename", callback: (item: unknown, options: unknown, event: MouseEvent, menu: unknown) => LGraphCanvas.onShowPropertyEditor(item, options, event, menu, this)}
    ];
};
Subgraph.prototype.onConnectionsChange = function (this: SubgraphNode, direction: number, index: number, connected: boolean, link: LLink): void {
    updateLinkColors(direction, this, index);
    if (!connected || !link || this._syncPaused) return;
    const input = direction === LiteGraph.INPUT;
    const slot = (input ? this.inputs : this.outputs)[index];
    const boundary = slot && this.subgraph.getNodeById(slot.boundaryId!);
    const other = this.graph?.getNodeById(input ? link.origin_id : link.target_id);
    const type = input ? other?.outputs[link.origin_slot]?.type : other?.inputs[link.target_slot]?.type;
    if (boundary?.properties.type === "" && typeof type === "string") boundary.setProperty("type", type);
};
Subgraph.prototype.syncSlots = function (this: SubgraphNode, excludeId?: number): void {
    if (this._syncPaused) return;
    const nodes = (this.subgraph as unknown as {_nodes: LGraphNode[]})._nodes;
    const validConnection = (LiteGraph as typeof LiteGraph & LiteGraphExtras).isValidConnection;
    for (const input of [true, false]) {
        const boundaries = nodes.filter(node => node.id !== excludeId && node.type === (input ? SUBGRAPH_INPUT : SUBGRAPH_OUTPUT)).sort((a, b) => a.id - b.id);
        const slots = input ? this.inputs : this.outputs;
        for (let i = slots.length - 1; i >= 0; i--) {
            if (!boundaries.some(node => node.id === slots[i].boundaryId)) {
                if (input) this.removeInput(i);
                else this.removeOutput(i);
            }
        }
        for (const node of boundaries) {
            const {name, type} = node.properties;
            const options = shapeAndColorsForSlotType(type, {boundaryId: node.id, nameLocked: true, locked: true});
            const index = slots.findIndex(slot => slot.boundaryId === node.id);
            if (index < 0) {
                if (input) this.addInput(name, type, options);
                else this.addOutput(name, type, options);
                continue;
            }
            const slot = slots[index];
            const oldType = slot.type;
            Object.assign(slot, {name, label: name, type, shape: undefined, color_on: undefined, color_off: undefined}, options);
            if (oldType && oldType !== type) {
                if (input) {
                    const link = this.graph?.links[this.inputs[index].link!];
                    const otherType = link && this.graph?.getNodeById(link.origin_id)?.outputs[link.origin_slot]?.type;
                    if (link && !validConnection(otherType!, type)) this.disconnectInput(index);
                } else {
                    for (const id of [...(this.outputs[index].links || [])]) {
                        const link = this.graph?.links[id];
                        const otherType = link && this.graph?.getNodeById(link.target_id)?.inputs[link.target_slot]?.type;
                        if (link && !validConnection(type, otherType!)) this.graph!.getNodeById(link.target_id)!.disconnectInput(link.target_slot);
                    }
                }
            }
            updateLinkColors(input ? LiteGraph.INPUT : LiteGraph.OUTPUT, this, index);
        }
    }
    this.size = this.computeSize();
    this.setDirtyCanvas(true, true);
};

function SubgraphInput(this: NativeNode) {
    this.iconName = "sign-in-alt";
    this.addProperty("name", "input", "string");
    this.addProperty("type", "", "string");
    this.addOutput("input", "");
}
function SubgraphOutput(this: NativeNode) {
    this.iconName = "sign-out-alt";
    this.addProperty("name", "output", "string");
    this.addProperty("type", "", "string");
    this.addInput("output", "");
}
SubgraphInput.title = "Subgraph Input";
SubgraphOutput.title = "Subgraph Output";
for (const [node, input] of [[SubgraphInput, true], [SubgraphOutput, false]] as const) {
    node.prototype.onPropertyChanged = function (this: NativeNode): void {
        const {name, type} = this.properties;
        const slot = (input ? this.outputs : this.inputs)[0];
        Object.assign(slot, {name, label: name, type, shape: undefined, color_on: undefined, color_off: undefined}, shapeAndColorsForSlotType(type!));
        this.graph?._subgraph_node?.syncSlots();
        this.size = this.computeSize();
        this.setDirtyCanvas(true, true);
    };
    node.prototype.onConfigure = node.prototype.onPropertyChanged;
    node.prototype.onAdded = function (this: NativeNode): void {
        this.graph?._subgraph_node?.syncSlots();
    };
    node.prototype.onRemoved = function (this: NativeNode): void {
        this.graph?._subgraph_node?.syncSlots(this.id);
    };
    node.prototype.onConnectionsChange = function (this: NativeNode, direction: number, index: number, connected: boolean, link: LLink): void {
        updateLinkColors(direction, this, index);
        if (!connected || !link || this.properties.type !== "" || this.graph?._subgraph_node?._syncPaused) return;
        const other = this.graph?.getNodeById(input ? link.target_id : link.origin_id);
        const type = input ? other?.inputs[link.target_slot]?.type : other?.outputs[link.origin_slot]?.type;
        if (typeof type === "string") this.setProperty("type", type);
    };
}
for (const node of [Subgraph, SubgraphInput, SubgraphOutput]) node.prototype.onDrawTitleBox = handleDrawTitleBox;

export = [Subgraph, SubgraphInput, SubgraphOutput] satisfies NodeModule;
