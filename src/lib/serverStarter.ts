import path = require("path");
import fs = require("fs-extra");
import {spawn, type ChildProcessWithoutNullStreams} from "child_process";
import {copyFile} from "./util";

let running = false;
let instance: ChildProcessWithoutNullStreams | null = null;
let stopPromise: Promise<void> | null = null;

async function copyPlugin(projectPath: string, projectInfo: {name: string}) {
    let projectName = projectInfo.name;
    await fs.mkdirs(path.join(projectPath, "lib", "plugins"));
    return copyFile(path.join(projectPath, "output", projectName + ".jar"), path.join(projectPath, "lib", "plugins", projectName + ".jar"));
}

function createLineSplitter(onLine?: (line: string) => void) {
    let tail = "";
    function split(chunk: Buffer | string) {
        let lines = (tail + chunk.toString()).split("\n");
        tail = lines.pop()!;
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

function startServer(projectPath: string, java: string, debug: boolean, outCb?: (line: string) => void, errCb?: (line: string) => void, stateCb?: (running: boolean) => void) {
    if (running || instance) return false;
    let args = ["-Xmx2G", "-Dcom.mojang.eula.agree=true"];
    if (debug) args.push("-Dpluginblueprint.debug=true");
    args.push("-jar", "paper.jar", "nogui");
    let spawned = spawn(java, args, {
        cwd: path.join(projectPath, "lib")
    });
    running = true;
    instance = spawned;
    spawned.once("spawn", () => { if (stateCb) stateCb(true); });
    spawned.on('error', (err) => {
        console.log('Failed to start subprocess.');
        console.warn(err);
        if (errCb) errCb(err.message);
        running = false;
        instance = null;
        if (stateCb) stateCb(false);
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
        if (stateCb) stateCb(false);
    });
    return true;
}

function stopServer() {
    if (stopPromise) return stopPromise;
    if (!instance) return Promise.resolve();
    let server = instance;
    stopPromise = new Promise<void>(resolve => {
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

function sendCommandToInstance(cmd: string, cb?: (error?: Error | null) => void) {
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


export {copyPlugin, createLineSplitter, startServer, stopServer, sendCommandToInstance, killInstance};
export const isRunning = () => {
    return running;
};
