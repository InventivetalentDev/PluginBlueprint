import {execFile} from "child_process";
import path = require("path");
import fs = require("fs-extra");

function compile(rootDir: string, projectInfo: {package: string}, jdk: {javac: string}, javaVersion: number, classpath: string[]) {
    return new Promise<{out: string; err: string}>((resolve, reject) => {
        let argfile = path.join(rootDir, "lib", "javac.args");
        let args = ["-encoding", "UTF-8", "--release", String(javaVersion), "-cp", classpath.join(path.delimiter),
            "-d", path.join(rootDir, "classes"), path.join(rootDir, "src", ...projectInfo.package.split("."), "GeneratedPlugin.java")];
        let quote = (value: string) => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
        fs.writeFile(argfile, args.map(quote).join("\n"), "utf-8", (err) => {
            if (err) return reject(err);
            console.log("Running " + jdk.javac + " @" + argfile);
            execFile(jdk.javac, ["@" + argfile], (err, stdout, stderr) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }

                console.log(`stdout: ${ stdout }`);
                console.log(`stderr: ${ stderr }`);

                resolve({
                    out: stdout,
                    err: stderr
                })
            });
        });
    })
}

function packageJar(rootDir: string, projectInfo: {name: string}, jdk: {jar: string}) {
    return new Promise<{out: string; err: string}>((resolve, reject) => {
        let args = ["cfm", path.join(rootDir, "output", projectInfo.name + ".jar"), path.join(rootDir, "src", "manifest"),
            "-C", path.join(rootDir, "classes"), "."];
        console.log("Running " + jdk.jar + " " + args.join(" "));
        execFile(jdk.jar, args, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            console.log(`stdout: ${ stdout }`);
            console.log(`stderr: ${ stderr }`);

            resolve({
                out: stdout,
                err: stderr
            })
        });
    })
}

export {compile, packageJar as package};
