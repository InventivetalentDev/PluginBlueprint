import type {ContextMenuItem, LGraphCanvas, LGraphNode} from "../../assets/lib/litegraph/litegraph";

export interface SlotOptions {
    locked?: boolean;
    nameLocked?: boolean;
    removable?: boolean;
    linkType?: string;
    className?: string;
    methodName?: string;
    methodSignature?: string;
    constructorName?: string;
    enumName?: string;
    paramName?: string;
    paramType?: string;
    paramIndex?: number;
    returnType?: string;
}

export interface NativeNode extends LGraphNode {
    classType: "native";
    getFields?(output: string[]): string[];
    getMethodBody?(input: (string | null)[], output: string[]): string;
    getExecBefore?(exec: string[][], output: string[]): string;
    getExecAfter?(exec: string[][], output: string[]): string;
    getOutputExpression?(slot: number): string;
    getMenuOptions?(graphCanvas: LGraphCanvas): ContextMenuItem[];
}
