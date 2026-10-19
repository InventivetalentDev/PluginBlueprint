import type {ContextMenuItem, IWidget, LGraphCanvas, LGraphNode} from "../../assets/lib/litegraph/litegraph";

export interface CommandArgument {
    name: string;
    type: "word" | "text" | "int" | "double" | "boolean" | "player";
}

export interface CodeSlot {
    name: string;
    type: string;
}

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
    operation?: string;
    widgets?: IWidget[];
    init?(booleanInputs?: boolean): void;
    properties: {
        type?: string;
        name?: string;
        string?: string;
        char?: string;
        number?: number;
        value?: boolean;
        castTo?: string;
        cancel?: boolean;
        text?: string;
        description?: string;
        aliases?: string;
        permission?: string;
        permissionMessage?: string;
        playersOnly?: boolean;
        arguments?: CommandArgument[];
        key?: string;
        code?: string;
        codeInputs?: CodeSlot[];
        codeOutputs?: CodeSlot[];
    };
    getFields?(output: string[]): string[];
    getOnEnable?(input: (string | null)[], output: string[], exec: string[][]): string;
    getMethodBody?(input: (string | null)[], output: string[]): string;
    getExecBefore?(exec: string[][], output: string[]): string;
    getExecAfter?(exec: string[][], output: string[]): string;
    getOutputExpression?(slot: number): string;
    getMenuOptions?(graphCanvas: LGraphCanvas): ContextMenuItem[];
    onOutputRemoved?(slot: number): void;
}

export type NodeFunction = (this: NativeNode) => void;
export type NodeModule = NodeFunction[];
