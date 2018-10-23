const path = require("path");
const fs = require("fs-extra");
const {exec, spawn} = require("child_process");

let running = false;
let instance = null;

function copyPlugin(projectPath, projectName) {
    return new Promise((resolve, reject) => {
        function doCopy() {
            let rs = fs.createReadStream(path.join(projectPath, "output", projectName + ".jar"));
            let ws = fs.createWriteStream(path.join(projectPath, "lib", "plugins", projectName + ".jar"));
            ws.on("close", function () {
                resolve();
            });
            rs.pipe(ws);
        }

        let pluginsDir = path.join(projectPath, "lib", "plugins");
        if (fs.existsSync(pluginsDir)) {
            fs.emptyDir(pluginsDir, function (err) {
                if (err) return reject(err);
                doCopy();
            });
        } else {
            fs.mkdirs(pluginsDir, function (err) {
                if (err) return reject(err);
                doCopy();
            })
        }
    })
}

function startServer(projectPath) {
    let spawned = spawn("java", ["-DIReallyKnowWhatIAmDoingISwear", "-Dcom.mojang.eula.agree=true", "-jar", "spigot.jar"], {
        cwd:path.join(projectPath, "lib"),
        // shell: true
    })
    running = true;
    instance = spawned;
    spawned.on('error', (err) => {
        console.log('Failed to start subprocess.');
        console.warn(err);
        running = false;
        instance = null;
    });
    spawned.stdout.on('data', (data) => {
        console.log(data.toString());
    });

    spawned.stderr.on('data', (data) => {
        console.log(data.toString());
    });
    spawned.on("exit", (code) => {
        console.log("Server process exited with code " + code);
        running = false;
        instance = null;
    });
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
    killInstance: killInstance,
    isRunning: () => {
        return running;
    }
}