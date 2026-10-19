import electron = require("electron");
const app = electron.app ? electron.app : process.type === "renderer" ? (require("@electron/remote") as typeof import("@electron/remote")).app : null;
import path = require("path");
import fs = require("fs-extra");
import type {ClassData, ClassDataFile, ClassDataMeta, ConstructorData, FieldData, MethodData, ParameterData} from "../types/classData";

let sharedDataPromise: Promise<{classStore: Record<string, ClassData>; meta: ClassDataMeta | undefined}> | undefined;

const INTERFACE_DUMMY_CONSTRUCTOR = {
    "name": "....",
    "isClass": false,
    "isInterface": false,
    "isEnum": false,
    "isEnumConstant": false,
    "isConstructor": true,
    "isField": false,
    "isMethod": false,
    "isOrdinaryClass": false,
    "signature": "()",
    "flatSignature": "()",
    "parameters": [],
    "typeParameters": []
};

class ClassDataStore {
    declare classStore: Record<string, ClassData>;
    declare meta: ClassDataMeta | undefined;
    declare initPromise: Promise<void> | undefined;
    declare loadClassFile: (fileName: string, external?: boolean) => Promise<Record<string, ClassData>>;

    constructor() {
        this.classStore = {};

        this.loadClassFile = function (fileName, external) {
            return new Promise<Record<string, ClassData>>(((resolve, reject) => {
                console.log("[ClassStore] Load " + fileName);
                fs.readFile((external ? path.join(app!.getPath("userData"), "jjdoc", fileName + ".json") : path.join(__dirname, "../../data/classes", fileName + ".json")), "utf-8", (err, data) => {
                    if (err) {
                        reject();
                        return;
                    }

                    let classData: ClassDataFile = JSON.parse(data);
                    if (fileName === "paper") this.meta = classData.meta;

                    for (let c = 0; c < classData.classes.length; c++) {
                        let clazz = Object.assign({}, classData.classes[c]) as ClassData;
                        clazz.fieldsByName = {};
                        clazz.methodsBySignature = {};
                        clazz.constructorsBySignature = {};

                        if (clazz.comment) {
                            clazz.comment = clazz.comment.split(".")[0];
                        }

                        if (clazz.isInterface) {// Add dummy default constructor if it's an interface
                            let constr = Object.assign({}, INTERFACE_DUMMY_CONSTRUCTOR);
                            constr.name = clazz.simpleName;
                            clazz.constructors.push(constr);
                        }

                        for (let f = 0; f < clazz.fields.length; f++) {
                            let field = Object.assign({}, clazz.fields[f]);
                            if (field.comment) {
                                field.comment = field.comment.split(".")[0];
                            }
                            clazz.fieldsByName[field.name.toLowerCase()] = field;
                        }
                        for (let m = 0; m < clazz.methods.length; m++) {
                            let method = Object.assign({}, clazz.methods[m]) as MethodData;
                            method.paramsByName = {};

                            if (method.comment) {
                                method.comment = method.comment.split(".")[0];
                            }

                            for (let p = 0; p < method.parameters.length; p++) {
                                let param = Object.assign({}, method.parameters[p]);
                                method.paramsByName[param.name.toLowerCase()] = param;
                            }

                            method.fullSignature = method.name + method.signature;
                            method.fullFlatSignature = method.name + method.flatSignature;
                            clazz.methodsBySignature[method.fullSignature] = method;
                        }
                        for (let m = 0; m < clazz.constructors.length; m++) {
                            let constr = Object.assign({}, clazz.constructors[m]) as ConstructorData;
                            constr.paramsByName = {};

                            if (constr.comment) {
                                constr.comment = constr.comment.split(".")[0];
                            }

                            for (let p = 0; p < constr.parameters.length; p++) {
                                let param = Object.assign({}, constr.parameters[p]);
                                constr.paramsByName[param.name.toLowerCase()] = param;
                            }

                            constr.fullSignature = constr.name + constr.signature;
                            constr.fullFlatSignature = constr.name + constr.flatSignature;
                            clazz.constructorsBySignature[constr.fullSignature] = constr;
                        }

                        this.classStore[clazz.qualifiedName.toLowerCase()] = clazz;
                    }


                    console.log("[ClassStore] Loaded " + fileName);
                    resolve(this.classStore);
                });
            }))
        }
    }


    init() {
        if (!sharedDataPromise) {
            sharedDataPromise = Promise.all([
                this.loadClassFile("java"),
                this.loadClassFile("paper")
            ]).then(() => {
                for (let clazz of Object.values(this.classStore)) {
                    let current: ClassData | null | undefined = clazz;
                    let extendsEvent = false;
                    let hasHandlerList = false;
                    while (current) {
                        if (current.qualifiedName === "org.bukkit.event.Event") extendsEvent = true;
                        if (current.methods.some(method => method.name === "getHandlerList" && method.isStatic)) hasHandlerList = true;
                        current = this.getClass(current.superclass);
                    }
                    clazz.isEvent = extendsEvent && hasHandlerList;
                    clazz.isObject = !clazz.isEvent && !clazz.isEnum;
                }
                return {classStore: this.classStore, meta: this.meta};
            });
        }
        if (!this.initPromise) {
            this.initPromise = sharedDataPromise.then(data => {
                this.classStore = data.classStore;
                this.meta = data.meta;
            });
        }
        return this.initPromise;
    }

    size() {
        return Object.keys(this.classStore).length;
    }

    getClassesByName() {
        return this.classStore;
    }

    getClass(className: string | null | undefined): ClassData | null | undefined {
        if (!className) return null;
        return this.classStore[className.toLowerCase()];
    }

    isAssignableTo(className: string, targetClass: string): boolean {
        if (className.toLowerCase() === targetClass.toLowerCase()) return true;
        const clazz = this.getClass(className);
        if (!clazz) return false;
        return clazz.interfaces.some(name => this.isAssignableTo(name, targetClass)) ||
            !!(clazz.superclass && this.isAssignableTo(clazz.superclass, targetClass));
    }

    getField(className: string | null | undefined, fieldName: string | null | undefined): FieldData | null | undefined {
        if (!className || !fieldName) return null;
        let clazz = this.classStore[className.toLowerCase()];
        if (!clazz) return null;
        return clazz.fieldsByName[fieldName.toLowerCase()];
    }


    getConstructor(className: string | null | undefined, constructorSignature: string | null | undefined): ConstructorData | null | undefined {
        if (!className || !constructorSignature) return null;
        let clazz = this.classStore[className.toLowerCase()];
        if (!clazz) return null;
        return clazz.constructorsBySignature[constructorSignature];
    }

    getConstructorParam(className: string | null | undefined, constructorSignature: string | null | undefined, paramName: string | null | undefined): ParameterData | null | undefined {
        if (!className || !constructorSignature || !paramName) return null;
        let clazz = this.classStore[className.toLowerCase()];
        if (!clazz) return null;
        let constructor = clazz.constructorsBySignature[constructorSignature];
        if (!constructor) return null;
        return constructor.paramsByName[paramName.toLowerCase()];
    }


    getMethod(className: string | null | undefined, methodSignature: string | null | undefined): MethodData | null | undefined {
        if (!className || !methodSignature) return null;
        let clazz = this.classStore[className.toLowerCase()];
        if (!clazz) return null;
        return clazz.methodsBySignature[methodSignature];
    }

    getMethodParam(className: string | null | undefined, methodSignature: string | null | undefined, paramName: string | null | undefined): ParameterData | null | undefined {
        if (!className || !methodSignature || !paramName) return null;
        let clazz = this.classStore[className.toLowerCase()];
        if (!clazz) return null;
        let method = clazz.methodsBySignature[methodSignature];
        if (!method) return null;
        return method.paramsByName[paramName.toLowerCase()];
    }


    getMethodSignatureFromMethodAndParamTypes(methodName: string, paramTypes: string[]) {
        return methodName + "(" + paramTypes.join(",") + ")";
    }
    getMethodSignatureFromData(methodData: Pick<MethodData, "name" | "parameters">) {
        let params = [];
        for (let i = 0; i < methodData.parameters.length; i++) {
            params.push(methodData.parameters[i].type.simpleName + methodData.parameters[i].type.dimension);
        }
        return this.getMethodSignatureFromMethodAndParamTypes(methodData.name, params);
    }

    getAllImplementingClasses(rootClass: string) {
        return getImplementingClasses(this.classStore, rootClass, []);
    }

    getAllExtendingClasses(rootClass: string) {
        return getExtendingClasses(this.classStore, rootClass, []);
    }

    getAllImplementingAndExtendingClasses(rootClass: string) {
        return getImplementingAndExtendingClasses(this.classStore, rootClass, []);
    }

}

function getImplementingAndExtendingClasses(classStore: Record<string, ClassData>, className: string, target: string[]): string[] {
    if (target.indexOf(className) === -1)
        target.push(className);
    let clazz = classStore[className.toLowerCase()];
    if (!clazz || ((!clazz.subInterfaces || clazz.subInterfaces.length === 0) && (!clazz.subClasses || clazz.subClasses.length === 0))) return target;
    if (clazz.subInterfaces) {
        for (let i = 0; i < clazz.subInterfaces.length; i++) {
            let cl = clazz.subInterfaces[i];
            getImplementingAndExtendingClasses(classStore, cl, target);
        }
    }
    if (clazz.subClasses) {
        for (let i = 0; i < clazz.subClasses.length; i++) {
            let cl = clazz.subClasses[i];
            getImplementingAndExtendingClasses(classStore, cl, target);
        }
    }
    return target;
}


function getImplementingClasses(classStore: Record<string, ClassData>, className: string, target: string[]): string[] {
    let clazz = classStore[className.toLowerCase()];
    if (target.indexOf(className) === -1)
        target.push(className);
    if (!clazz || !clazz.subInterfaces || clazz.subInterfaces.length === 0) return target;
    for (let i = 0; i < clazz.subInterfaces.length; i++) {
        let cl = clazz.subInterfaces[i];
        getImplementingClasses(classStore, cl, target);
    }
    return target;
}


function getExtendingClasses(classStore: Record<string, ClassData>, className: string, target: string[]): string[] {
    let clazz = classStore[className.toLowerCase()];
    if (target.indexOf(className) === -1)
        target.push(className);
    if (!clazz || !clazz.subClasses || clazz.subClasses.length === 0) return target;
    for (let i = 0; i < clazz.subClasses.length; i++) {
        let cl = clazz.subClasses[i];
        getExtendingClasses(classStore, cl, target);
    }
    return target;
}

export = ClassDataStore;
