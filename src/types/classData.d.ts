export interface TypeVariable {
    name: string;
    bounds: string[];
}

export interface TypeRef {
    qualifiedName: string;
    simpleName: string;
    dimension: string;
    isPrimitive: boolean;
    elementType: TypeRef | Record<string, never>;
    typeVariable?: TypeVariable;
}

export interface MemberData {
    name: string;
    comment: string;
    isClass: boolean;
    isConstructor: boolean;
    isDeprecated: boolean;
    isEnum: boolean;
    isEnumConstant: boolean;
    isField: boolean;
    isInterface: boolean;
    isMethod: boolean;
    isOrdinaryClass: boolean;
    isStatic: boolean;
}

export interface FieldData extends MemberData {
    type: TypeRef;
    constantValue?: string;
}

export interface ParameterData {
    name: string;
    type: TypeRef;
}

export interface CallableData extends MemberData {
    signature: string;
    flatSignature: string;
    parameters: ParameterData[];
    typeParameters: TypeVariable[];
    isAbstract: boolean;
    isDefault: boolean;
}

export interface ConstructorData extends Omit<CallableData, "comment" | "isAbstract" | "isDefault" | "isDeprecated" | "isStatic"> {
    // The store's dummy interface constructor omits these metadata fields.
    comment?: string;
    isAbstract?: boolean;
    isDefault?: boolean;
    isDeprecated?: boolean;
    isStatic?: boolean;
    fullSignature: string;
    fullFlatSignature: string;
    paramsByName: Record<string, ParameterData>;
}

export interface MethodData extends CallableData {
    returnType: TypeRef;
    fullSignature: string;
    fullFlatSignature: string;
    paramsByName: Record<string, ParameterData>;
}

export interface RawClassData extends MemberData, TypeRef {
    package: string;
    constructors: CallableData[];
    fields: FieldData[];
    methods: (CallableData & {returnType: TypeRef})[];
    enumConstants: string[];
    innerClasses: string[];
    interfaces: string[];
    subClasses: string[];
    subInterfaces: string[];
    superclass: string | null;
    typeParameters: TypeVariable[];
    isAbstract: boolean;
    isInnerClass: boolean;
}

export interface ClassData extends Omit<RawClassData, "constructors"> {
    constructors: Omit<ConstructorData, "fullSignature" | "fullFlatSignature" | "paramsByName">[];
    fieldsByName: Record<string, FieldData>;
    methodsBySignature: Record<string, MethodData>;
    constructorsBySignature: Record<string, ConstructorData>;
    isEvent: boolean;
    isObject: boolean;
}

export interface ClassDataMeta {
    minecraftVersion: string;
    paperBuild: number;
    paperApiVersion: string;
    adventureVersion: string;
    javaVersion: number;
    generatedAt: string;
}

export interface ClassDataFile {
    meta: ClassDataMeta;
    size: number;
    classes: RawClassData[];
}
