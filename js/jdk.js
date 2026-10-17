const fs = require("fs-extra");
const path = require("path");
const {execFile} = require("child_process");
const {promisify} = require("util");
const {createHash} = require("crypto");
const run = promisify(execFile);

function jdkTools(home) {
    let suffix = process.platform === "win32" ? ".exe" : "";
    return {
        java: home ? path.resolve(home, "bin", "java" + suffix) : "java",
        javac: home ? path.resolve(home, "bin", "javac" + suffix) : "javac",
        jar: home ? path.resolve(home, "bin", "jar" + suffix) : "jar"
    };
}

async function findJdk(requiredMajor, jdkDir) {
    let homes = [];
    if (process.env.JAVA_HOME) homes.push(process.env.JAVA_HOME);
    homes.push(null);
    let managed = path.join(jdkDir, String(requiredMajor));
    if (await fs.pathExists(managed)) {
        let folders = (await fs.readdir(managed, {withFileTypes: true})).filter(entry => entry.isDirectory());
        if (folders.length === 1) {
            homes.push(path.join(managed, folders[0].name, ...(process.platform === "darwin" ? ["Contents", "Home"] : [])));
        }
    }
    for (let home of homes) {
        let tools = jdkTools(home);
        try {
            let result = await run(tools.javac, ["-version"]);
            let match = (result.stdout + result.stderr).match(/javac\s+(?:1\.)?(\d+)/);
            if (!match || Number(match[1]) < requiredMajor) continue;
            await run(tools.java, ["-version"]);
            return Object.assign(tools, {version: Number(match[1])});
        } catch (err) {
            console.log("JDK unavailable: " + (home || "PATH"));
        }
    }
    return null;
}

async function downloadJdk(major, jdkDir, onProgress) {
    let os = {win32: "windows", darwin: "mac", linux: "linux"}[process.platform];
    let architecture = {x64: "x64", arm64: "aarch64"}[process.arch];
    if (!os || !architecture) throw new Error("Unsupported JDK platform: " + process.platform + "/" + process.arch);
    let response = await fetch("https://api.adoptium.net/v3/assets/latest/" + major + "/hotspot?architecture=" + architecture + "&image_type=jdk&os=" + os + "&vendor=eclipse");
    if (!response.ok) throw new Error("JDK metadata: HTTP " + response.status);
    let pkg = (await response.json())[0].binary.package;
    await fs.ensureDir(jdkDir);
    let archive = path.join(jdkDir, pkg.name);
    let target = path.join(jdkDir, String(major));
    try {
        response = await fetch(pkg.link);
        if (!response.ok) throw new Error("JDK download: HTTP " + response.status);
        let hash = createHash("sha256");
        let received = 0;
        let file = await fs.open(archive, "w");
        try {
            for await (let chunk of response.body) {
                hash.update(chunk);
                await fs.write(file, chunk);
                received += chunk.length;
                if (onProgress) onProgress(received / pkg.size);
            }
        } finally {
            await fs.close(file);
        }
        if (hash.digest("hex") !== pkg.checksum) throw new Error("JDK SHA-256 mismatch");
        await fs.ensureDir(target);
        let tar = process.platform === "win32" ? path.join(process.env.SystemRoot, "System32", "tar.exe") : "tar";
        await run(tar, ["-xf", archive, "-C", target]);
        let folders = (await fs.readdir(target, {withFileTypes: true})).filter(entry => entry.isDirectory());
        if (folders.length !== 1) throw new Error("Expected one JDK folder in " + target);
        let tools = jdkTools(path.join(target, folders[0].name, ...(os === "mac" ? ["Contents", "Home"] : [])));
        let result = await run(tools.javac, ["-version"]);
        let version = Number((result.stdout + result.stderr).match(/javac\s+(?:1\.)?(\d+)/)[1]);
        return Object.assign(tools, {version});
    } finally {
        await fs.remove(archive);
    }
}

module.exports = {findJdk, downloadJdk};
