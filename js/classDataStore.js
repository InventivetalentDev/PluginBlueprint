const path = require("path");
const fs = require("fs");

function ClassDataStore() {
    this.classStore = {};

    this.loadClassFile = function (fileName) {
        console.log("[ClassStore] Load " + fileName);
        let data = fs.readFileSync(path.join(__dirname, "../data/" + fileName + ".json"), "utf-8");
        data = JSON.parse(data);

        for (let c = 0; c < data.classes.length; c++) {
            let clazz = Object.assign({}, data.classes[c]);
            clazz.fieldsByName = {};
            clazz.methodsByName = {};
            clazz.isEvent = clazz.name.indexOf("Event") !== -1;

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

                clazz.methodsByName[method.name.toLowerCase()] = method;
            }

            this.classStore[clazz.name.toLowerCase()] = clazz;
        }
    }
}


ClassDataStore.prototype.init = function () {
    this.loadClassFile("javaClasses");
    this.loadClassFile("bukkitClasses")
};

ClassDataStore.prototype.getClassesByName = function () {
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

ClassDataStore.prototype.getMethod = function (className, methodName) {
    if (!className || !methodName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    return clazz.methodsByName[methodName.toLowerCase()];
};

ClassDataStore.prototype.getMethodParam = function (className, methodName, paramName) {
    if (!className || !methodName || !paramName) return null;
    let clazz = this.classStore[className.toLowerCase()];
    if (!clazz) return null;
    let method = clazz.methodsByName[methodName.toLowerCase()];
    if (!method) return null;
    return method.paramsByName[paramName.toLowerCase()];
};


module.exports = ClassDataStore;