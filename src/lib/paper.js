const fs = require("fs-extra");
const path = require("path");
const {createHash} = require("crypto");
const {execFile} = require("child_process");
const {promisify} = require("util");
const {copyFile} = require("./util");
const run = promisify(execFile);
const USER_AGENT = "PluginBlueprint/" + require("../package.json").version + " (https://github.com/InventivetalentDev/PluginBlueprint)";
let meta;

function getDataMeta() {
    if (!meta) meta = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/classes/paper.json"), "utf-8")).meta;
    return meta;
}

async function ensureServer({libDir, cacheDir, minecraftVersion, java, onProgress}) {
    let serverJar = path.join(libDir, "paper.jar");
    if (await fs.pathExists(serverJar) && await fs.pathExists(path.join(libDir, "versions", minecraftVersion))) return;
    let response = await fetch("https://fill.papermc.io/v3/projects/paper/versions/" + encodeURIComponent(minecraftVersion) + "/builds/latest", {
        headers: {"User-Agent": USER_AGENT}
    });
    if (!response.ok) throw new Error("Paper metadata: HTTP " + response.status);
    let build = await response.json();
    let artifact = build.downloads["server:default"];
    let cachedJar = path.join(cacheDir, "paper-" + minecraftVersion + "-" + build.id + ".jar");
    await fs.ensureDir(cacheDir);
    await fs.ensureDir(libDir);
    let valid = await fs.pathExists(cachedJar) && createHash("sha256").update(await fs.readFile(cachedJar)).digest("hex") === artifact.checksums.sha256;
    if (!valid) {
        if (onProgress) onProgress("Downloading Paper " + minecraftVersion + " build " + build.id + "…");
        response = await fetch(artifact.url, {headers: {"User-Agent": USER_AGENT}});
        if (!response.ok) throw new Error("Paper download: HTTP " + response.status);
        let bytes = Buffer.from(await response.arrayBuffer());
        if (createHash("sha256").update(bytes).digest("hex") !== artifact.checksums.sha256) throw new Error("Paper SHA-256 mismatch");
        await fs.writeFile(cachedJar, bytes);
    }
    await copyFile(cachedJar, serverJar);
    await fs.remove(path.join(libDir, "libraries"));
    await fs.remove(path.join(libDir, "versions"));
    if (onProgress) onProgress("Unpacking Paper…");
    await run(java, ["-Dpaperclip.patchonly=true", "-jar", "paper.jar"], {cwd: libDir});
}

function getClasspath(libDir) {
    let jars = [];
    function visit(directory) {
        if (!fs.existsSync(directory)) return;
        for (let entry of fs.readdirSync(directory, {withFileTypes: true})) {
            let file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (entry.name.endsWith(".jar")) jars.push(file);
        }
    }
    visit(path.join(libDir, "libraries"));
    visit(path.join(libDir, "versions"));
    return jars.sort();
}

module.exports = {getDataMeta, ensureServer, getClasspath};
