const path = require("path");
const fs = require("fs-extra");
const {exec, spawn} = require("child_process");
const {copyFile} = require("./util");

let running = false;
let instance = null;

function copyPlugin(projectPath, projectName, skipEmpty, skipReloadHelper) {
    return new Promise((resolve, reject) => {
        function doCopy() {
            copyFile(path.join(projectPath, "output", projectName + ".jar"), path.join(projectPath, "lib", "plugins", projectName + ".jar"))// copy plugin
                .then(() => {
                    if (skipReloadHelper) {
                        resolve()
                    } else {
                        copyFile(path.join(__dirname, "../assets/lib/livereload.jar"), path.join(projectPath, "lib", "plugins", "livereload.jar"))// copy livereload helper plugin
                            .then(resolve).catch(reject);
                    }
                }).catch(reject);
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

function startServer(projectPath, outCb, errCb) {
    if (running || instance) return false;
    let spawned = spawn("java", ["-DIReallyKnowWhatIAmDoingISwear", "-Dcom.mojang.eula.agree=true", "-jar", "spigot.jar"], {
        cwd: path.join(projectPath, "lib"),
        // shell: true
    });
    running = true;
    instance = spawned;
    spawned.on('error', (err) => {
        console.log('Failed to start subprocess.');
        console.warn(err);
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
    sendCommandToInstance: sendCommandToInstance,
    killInstance: killInstance,
    isRunning: () => {
        return running;
    }
}