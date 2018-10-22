const path = require("path");
const fs = require("fs-extra");
const childProcess = require("child_process");

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
    childProcess.exec("start cmd.exe /K \"cd /D \"" + path.join(projectPath, "lib") + "\" && java -DIReallyKnowWhatIAmDoingISwear -Dcom.mojang.eula.agree=true -jar spigot.jar\"");
}

module.exports = {
    copyPlugin: copyPlugin,
    startServer: startServer
}