const path = require("path");
const fs = require("fs");

function ClassDataStore() {
    this.classStore = {};

    this.loadClassFile = function (fileName) {
        return new Promise(((resolve, reject) => {
            console.log("[ClassStore] Load " + fileName);
            fs.readFile(path.join(__dirname, "../data/classes/" + fileName + ".json"), "utf-8", (err, data) => {
                if (err) {
                    reject();
                    return;
                }

                data = JSON.parse(data);

                for (let c = 0; c < data.classes.length; c++) {
                    let clazz = Object.assign({}, data.classes[c]);
                    clazz.fieldsByName = {};
                    clazz.methodsBySignature = {};
                    clazz.constructorsBySignature = {};
                    clazz.isEvent = clazz.qualifiedName.endsWith("Event");
                    clazz.isObject = !clazz.isEvent && !clazz.isEnum;

                    for (let f = 0; f < clazz.fields.length; f++) {
                        let field = Object.assign({}, clazz.fields[f]);
                        clazz.fieldsByName[field.name.toLowerCase()] = field;
                    }
                    for (let m = 0; m < clazz.methods.length; m++) {
                        let method = Object.assign({}, clazz.methods[m]);
                        method.paramsByName = {};

                        for (let p = 0; p < method.parameters.length; p++) {
                            let param = Object.assign({}, method.parameters[p]);
                            method.paramsByName[param.name.toLowerCase()] = param;
                        }

                        method.fullSignature = method.name + method.signature;
                        method.fullFlatSignature = method.name + method.flatSignature;
                        clazz.methodsBySignature[method.fullSignature] = method;
                    }
                    for (let m = 0; m < clazz.constructors.length; m++) {
                        let constr = Object.assign({}, clazz.constructors[m]);
                        constr.paramsByName = {};

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


ClassDataStore.prototype.init = function () {
    return Promise.all([
        this.loadClassFile("java"),
        this.loadClassFile("spigot")
    ]);
};

ClassDataStore.prototype.size = function () {
    return Object.keys(this.classStore).length;
};

ClassDataStore.prototype.getClassesByName = function () {
    console.log(this)
    return this.classStore;
};

ClassDataStore.prototype.getClass = function (className) {
    if (!className) return null;
    return this.classStore[className.toLowerCase()];
};
ClassDataStore.prototype.getField = function (className, fieldName) {
    if (!className || !fieldName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    return clazz.fieldsByName[fieldName.toLowerCase()];
};


ClassDataStore.prototype.getConstructor = function (className, constructorSignature) {
    if (!className || !constructorSignature) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    return clazz.constructorsBySignature[constructorSignature];
};

ClassDataStore.prototype.getConstructorParam = function (className, constructorSignature, paramName) {
    if (!className || !constructorName || !paramName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    let constructor = clazz.constructorsBySignature[constructorSignature];
    if (!constructor) return null;
    return constructor.paramsByName[paramName.toLowerCase()];
};


ClassDataStore.prototype.getMethod = function (className, methodSignature) {
    if (!className || !methodSignature) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    return clazz.methodsBySignature[methodSignature];
};

ClassDataStore.prototype.getMethodParam = function (className, methodSignature, paramName) {
    if (!className || !methodSignature || !paramName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    let method = clazz.methodsBySignature[methodSignature];
    if (!method) return null;
    return method.paramsByName[paramName.toLowerCase()];
};


ClassDataStore.prototype.getMethodSignatureFromMethodAndParamTypes = function (methodName, paramTypes) {
    return methodName + "(" + paramTypes.join(",") + ")";
};
ClassDataStore.prototype.getMethodSignatureFromData = function (methodData) {
    let params = [];
    for (let i = 0; i < methodData.parameters.length; i++) {
        params.push(methodData.parameters[i].type.simpleName + methodData.parameters[i].type.dimension);
    }
    return this.getMethodSignatureFromMethodAndParamTypes(methodData.name, params);
};


module.exports = ClassDataStore;