const path = require("path");
const fs = require("fs");

function ClassDataStore() {
    this.classStore = {};

    this.loadClassFile = function (fileName) {
        return new Promise(((resolve, reject) => {
            console.log("[ClassStore] Load " + fileName);
            fs.readFile(path.join(__dirname, "../data/" + fileName + ".json"), "utf-8", (err, data) => {
                if (err) {
                    reject();
                    return;
                }

                data = JSON.parse(data);

                for (let c = 0; c < data.classes.length; c++) {
                    let clazz = Object.assign({}, data.classes[c]);
                    clazz.fieldsByName = {};
                    clazz.methodsBySignature = {};
                    clazz.constructorsByName = {};
                    clazz.isEvent = clazz.name.indexOf("Event") !== -1;
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

                        method.signature = this.getMethodSignatureFromData(method);
                        clazz.methodsBySignature[method.signature] = method;
                    }
                    for (let m = 0; m < clazz.constructors.length; m++) {
                        let constr = Object.assign({}, clazz.constructors[m]);
                        constr.paramsByName = {};

                        for (let p = 0; p < constr.parameters.length; p++) {
                            let param = Object.assign({}, constr.parameters[p]);
                            constr.paramsByName[param.name.toLowerCase()] = param;
                        }

                        clazz.constructorsByName[constr.name.toLowerCase()] = constr;
                    }

                    this.classStore[clazz.name.toLowerCase()] = clazz;
                }

                console.log("[ClassStore] Loaded " + fileName);
                resolve(this.classStore);
            });
        }))
    }
}


ClassDataStore.prototype.init = function () {
    return Promise.all([
        this.loadClassFile("javaClasses"),
        this.loadClassFile("bukkitClasses")
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


ClassDataStore.prototype.getConstructor = function (className, constructorName) {
    if (!className || !constructorName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    return clazz.constructorsByName[constructorName.toLowerCase()];
};

ClassDataStore.prototype.getConstructorParam = function (className, constructorName, paramName) {
    if (!className || !constructorName || !paramName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    let constructor = clazz.constructorsByName[constructorName.toLowerCase()];
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
        params.push(this.typeToSimple(methodData.parameters[i].type) + methodData.parameters[i].type_dimension);
    }
    return this.getMethodSignatureFromMethodAndParamTypes(methodData.name, params);
};

ClassDataStore.prototype.typeToSimple = function (type) {
    if (!type) return null;
    let split = type.split(".");
    return split[split.length - 1];
};

module.exports = ClassDataStore;