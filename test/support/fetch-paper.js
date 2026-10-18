const path = require("path");
const {ensureServer, getDataMeta} = require("../../js/paper");

const dir = path.resolve(process.argv[2]);
ensureServer({
    libDir: dir,
    cacheDir: path.join(dir, "cache"),
    minecraftVersion: getDataMeta().minecraftVersion,
    java: "java"
});
