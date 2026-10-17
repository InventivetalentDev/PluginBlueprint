const path = require("path");
const fs = require("fs-extra");
const {spawn} = require("child_process");
const {copyFile} = require("./util");

let running = false;
let instance = null;

function copyPlugin(projectPath, projectInfo, skipEmpty) {
    let projectName = projectInfo.name;
    return new Promise((resolve, reject) => {
        function doCopy() {
            copyFile(path.join(projectPath, "output", projectName + ".jar"), path.join(projectPath, "lib", "plugins", projectName + ".jar"))
                .then(resolve).catch(reject);
        }

        let pluginsDir = path.join(projectPath, "lib", "plugins");
        if (fs.existsSync(pluginsDir)) {
            if (skipEmpty) {
                doCopy();
            } else {
                fs.emptyDir(pluginsDir, function (err) {
                    if (err) return reject(err);
                    doCopy();
                });
            }
        } else {
            fs.mkdirs(pluginsDir, function (err) {
                if (err) return reject(err);
                doCopy();
            })
        }
    })
}

function startServer(projectPath, java, outCb, errCb) {
    if (running || instance) return false;
    let spawned = spawn(java, ["-Xmx2G", "-DIReallyKnowWhatIAmDoingISwear", "-Dcom.mojang.eula.agree=true", "-jar", "paper.jar", "nogui"], {
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
    spawned.stdout.on('data', (data) => {
        if (outCb) outCb(data.toString())
    });
    spawned.stderr.on('data', (data) => {
        if (errCb) errCb(data.toString());
    });
    spawned.on("exit", (code) => {
        console.log("Server process exited with code " + code);
        running = false;
        instance = null;
    });
    return true;
}

function stopServer() {
    return new Promise(resolve => {
        if (!instance) return resolve();
        let server = instance;
        let timeout = setTimeout(() => server.kill("SIGKILL"), 30000);
        server.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
        server.stdin.write("stop\n");
    });
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
    startServer: startServer,
    stopServer: stopServer,
    sendCommandToInstance: sendCommandToInstance,
    killInstance: killInstance,
    isRunning: () => {
        return running;
    }
};