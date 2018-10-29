const {exec} = require('child_process');
const path = require("path");

function testForJavac() {
    return new Promise((resolve, reject) => {
        exec("javac -version", (err, stdout, stderr) => {
            console.log(stdout);
            console.log(stderr);
            if (err) {
                reject();
            } else if ((stdout && stdout.startsWith("javac")) || (stderr && stderr.startsWith("javac"))) {
                resolve();
            } else {
                reject();
            }
        })
    })
}

function compile(rootDir, projectInfo) {
    return new Promise((resolve, reject) => {
        //TODO: variable classpath
        let cl = "javac -cp \"" + path.join(rootDir, "lib", "spigot.jar") + "\" -d \"" + path.join(rootDir, "classes") + "\" \"" + path.join(rootDir, "src", projectInfo.package.split(".").join("\\"), "GeneratedPlugin.java") + "\"";
        console.log("Running \"" + cl + "\"...");
        exec(cl, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            // the *entire* stdout and stderr (buffered)
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);

            resolve({
                out: stdout,
                err: stderr
            })
        });
    })
}

function package(rootDir, projectInfo) {
    return new Promise((resolve, reject) => {
        let cl = "jar cfm \"" + path.join(rootDir, "output", projectInfo.name + ".jar") + "\" \"" + path.join(rootDir, "src", "manifest") + "\" -C \"" + path.join(rootDir, "classes") + "\" .";
        console.log("Running \"" + cl + "\"...");
        exec(cl, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            // the *entire* stdout and stderr (buffered)
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);

            resolve({
                out: stdout,
                err: stderr
            })
        });
    })
}

module.exports = {
    compile: compile,
    package: package,
    testForJavac: testForJavac
}