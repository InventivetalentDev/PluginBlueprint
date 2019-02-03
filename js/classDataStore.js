const {app} = require("electron");
const path = require("path");
const fs = require("fs-extra");
const request = require("request");

function ClassDataStore() {
    this.classStore = {};

    this.loadClassFile = function (fileName, external) {
        return new Promise(((resolve, reject) => {
            console.log("[ClassStore] Load " + fileName);
            fs.readFile((external ? path.join(app.getPath("userData"), "jjdoc", fileName + ".json") : path.join(__dirname, "../data/classes", fileName + ".json")), "utf-8", (err, data) => {
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
    console.log(this);
    return this.classStore;
};

ClassDataStore.getAvailableLibraries = function () {
    return new Promise((resolve, reject) => {
        request("https://jjdoc.inventivetalent.org/libs", function (err, resp, body) {
            if (err) {
                reject(err);
                return;
            }
            if (resp.statusCode !== 200) {
                reject(body);
                return;
            }
            resolve(JSON.parse(body));
        });
    })
};

ClassDataStore.downloadLibraryDoc = function (libraryName) {
   return new Promise((resolve, reject) => {
       let docDir = path.join(app.getPath("userData"), "jjdoc");
       fs.ensureDir(docDir).then(()=>{
           let docFile = path.join(docDir, libraryName + ".json");
           request("https://jjdoc.inventivetalent.org/libs/"+libraryName+"/all",function (err,resp,body) {
               if (err) {
                   reject(err);
                   return;
               }
               if (resp.statusCode !== 200) {
                   reject(body);
                   return;
               }
               let stream = fs.createWriteStream(docFile);
               resp.pipe(stream);
               resolve();
           })
       })
   })
};

ClassDataStore.prototype.loadLibrary = function (libraryName) {
    let that = this;
    return new Promise((resolve, reject) =>  {
        if (fs.existsSync(path.join(app.getPath("userData"), "jjdoc", libraryName + ".json"))) {
            that.loadClassFile(libraryName, true).then(resolve).catch(reject);
        }else{
            ClassDataStore.downloadLibraryDoc(libraryName).then(() => {
                that.loadClassFile(libraryName, true).then(resolve).catch(reject);
            }).catch(reject);
        }
    })
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
    if (!className || !constructorSignature || !paramName) return null;
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

ClassDataStore.prototype.getAllImplementingClasses = function (rootClass) {
    return getImplementingClasses(this.classStore, rootClass, []);
};

ClassDataStore.prototype.getAllExtendingClasses = function (rootClass) {
    return getExtendingClasses(this.classStore, rootClass, []);
};

ClassDataStore.prototype.getAllImplementingAndExtendingClasses = function (rootClass) {
    return getImplementingAndExtendingClasses(this.classStore, rootClass, []);
};

function getImplementingAndExtendingClasses(classStore, className, target) {
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


function getImplementingClasses(classStore, className, target) {
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


function getExtendingClasses(classStore, className, target) {
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

module.exports = ClassDataStore;