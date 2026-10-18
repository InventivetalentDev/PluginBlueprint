const path = require("path");
const fs = require("fs-extra");
const {spawn} = require("child_process");
const {copyFile} = require("./util");

let running = false;
let instance = null;
let stopPromise = null;

async function copyPlugin(projectPath, projectInfo) {
    let projectName = projectInfo.name;
    await fs.mkdirs(path.join(projectPath, "lib", "plugins"));
    return copyFile(path.join(projectPath, "output", projectName + ".jar"), path.join(projectPath, "lib", "plugins", projectName + ".jar"));
}

function createLineSplitter(onLine) {
    let tail = "";
    function split(chunk) {
        let lines = (tail + chunk.toString()).split("\n");
        tail = lines.pop();
        for (let i = 0; i < lines.length; i++) {
            if (onLine) onLine(lines[i].replace(/\r$/, ""));
        }
    }
    split.flush = () => {
        if (tail.length) {
            let line = tail;
            tail = "";
            if (onLine) onLine(line.replace(/\r$/, ""));
        }
    };
    return split;
}

function startServer(projectPath, java, debug, outCb, errCb) {
    if (running || instance) return false;
    let args = ["-Xmx2G", "-Dcom.mojang.eula.agree=true"];
    if (debug) args.push("-Dpluginblueprint.debug=true");
    args.push("-jar", "paper.jar", "nogui");
    let spawned = spawn(java, args, {
        cwd: path.join(projectPath, "lib")
    });
    running = true;
    instance = spawned;
    spawned.on('error', (err) => {
        console.log('Failed to start subprocess.');
        console.warn(err);
        if (errCb) errCb(err.message);
        running = false;
        instance = null;
    });
    let stdout = createLineSplitter(outCb);
    let stderr = createLineSplitter(errCb);
    spawned.stdout.on('data', stdout);
    spawned.stderr.on('data', stderr);
    spawned.on("exit", (code) => {
        stdout.flush();
        stderr.flush();
        console.log("Server process exited with code " + code);
        running = false;
        instance = null;
    });
    return true;
}

function stopServer() {
    if (stopPromise) return stopPromise;
    if (!instance) return Promise.resolve();
    let server = instance;
    stopPromise = new Promise(resolve => {
        let timeout = setTimeout(() => server.kill("SIGKILL"), 30000);
        server.once("exit", () => {
            clearTimeout(timeout);
            stopPromise = null;
            resolve();
        });
        server.stdin.write("stop\n");
    });
    return stopPromise;
}

function sendCommandToInstance(cmd, cb) {
    console.log(cmd);
    if (!running) return;
    if (!instance) return;
    if (!instance.stdin) return;
    instance.stdin.write(cmd + "\n"/* \n is required to flush the input */, "utf-8", cb);
}

function killInstance() {
    console.log(instance);
    console.log(running);
    if (instance) {
        instance.kill();
    }
}


module.exports = {
    copyPlugin: copyPlugin,
    createLineSplitter: createLineSplitter,
    startServer: startServer,
    stopServer: stopServer,
    sendCommandToInstance: sendCommandToInstance,
    killInstance: killInstance,
    isRunning: () => {
        return running;
    }
};
