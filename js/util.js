function copyFile(src, dest) {
    return new Promise((resolve, reject) => {
        console.debug("copy ", src, "->", dest);
        if (!fs.existsSync(src)) {
            reject();
            return;
        }
        let rs = fs.createReadStream(src);
        let ws = fs.createWriteStream(dest);
        ws.on("close", function () {
            resolve();
        });
        ws.on("error", function () {
            reject();
        });
        rs.pipe(ws);
    })
}

function getNullForType(type) {
    if (type) {
        if (typeof type !== "string") {
            type = type.qualifiedName;
        }
        if (type === "boolean") {
            return "false";
        }
        if (type === "byte" || type === "short" || type === "int" || type === "long" || type === "float" || type === "double") {
            return "0";
        }
        if (type === "char") {
            return "''";
        }
    }
    return "null";
}

function guessTypeFromValue(value) {
    if(value){
        if ("true" === value || "false" === "value") {
            return "boolean";
        }

    }
}


module.exports = {copyFile, getNullForType};

