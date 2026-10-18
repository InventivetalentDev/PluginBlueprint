import "../../assets/lib/litegraph/litegraph";
import type {INodeInputSlot, INodeOutputSlot, INodeSlot, LGraphGroup, LGraphNode, LGraphNodeConstructor, Vector2, Vector4} from "../../assets/lib/litegraph/litegraph";
import type {SlotOptions} from "./nodes";
import type {IconName, IconPrefix} from "@fortawesome/fontawesome-svg-core";

export type SlotType = string | number | null;
export type OptionalSlot = [name: string, type: SlotType, options?: Partial<INodeSlot>] | null;

declare module "../../assets/lib/litegraph/litegraph" {
    interface LGraphNode {
        addInput(name: string, type: SlotType, options?: Partial<INodeInputSlot>): INodeInputSlot;
        addOutput(name: string, type: SlotType, options?: Partial<INodeOutputSlot>): INodeOutputSlot;
        desc?: string;
        description?: string;
        descBlockHeight?: number;
        iconName?: IconName;
        iconColor?: string;
        iconPrefix?: IconPrefix;
        optional_inputs?: OptionalSlot[];
        optional_outputs?: OptionalSlot[];
        onDrawTitleBox?(ctx: CanvasRenderingContext2D, titleHeight: number, size: Vector2, scale: number): void;
        onBounding?(rect: Vector4): void;
        onInputDblClick?(slot: number, event: MouseEvent): void;
        onOutputDblClick?(slot: number, event: MouseEvent): void;
        triggerSlot(slot: number, param?: unknown, link_id?: number): void;
    }

    interface LGraph {
        onNodeConnectionChange?(slotType: number, node: LGraphNode, slot: number, otherNode?: LGraphNode, otherSlot?: number): void;
        onNodePropertyChanged?(node: LGraphNode, property: string, value: unknown): void;
        onNodeRemoved(node: LGraphNode): void;
        onConnectionChange(): void;
        onAfterChange?(graph: LGraph, info?: LGraphNode | LGraphGroup): void;
        add(group: LGraphGroup): void;
    }

    interface LGraphCanvas {
        setZoom(value: number, center?: Vector2): void;
    }

    interface INodeSlot extends SlotOptions {}

    interface LLink {
        color?: string;
    }
}

export interface LiteGraphExtras {
    isValidConnection(outputType: SlotType, inputType: SlotType): boolean;
    cloneObject<T>(value: T, target?: T): T;
    registerNodeAndSlotType(type: string | LGraphNode | LGraphNodeConstructor, slotType: SlotType, output?: boolean): void;
    LGraphGroup: typeof LGraphGroup;
    DEFAULT_GROUP_FONT_SIZE: number;
    search_show_all_on_open: boolean;
}
