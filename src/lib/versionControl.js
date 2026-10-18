const git = require("isomorphic-git");
const fs = require("fs");
const http = require("isomorphic-git/http/node");
const path = require("path");
const prompt = require("electron-prompt");
const {app, safeStorage} = require("electron");
const {copyFile} = require("./util");

function init(projectPath) {
    return new Promise((resolve, reject) => {
        copyFile(path.join(__dirname, "../assets/projectGitignore.txt"), path.join(projectPath, ".gitignore"))
            .then(() => {
                return git.init({fs, dir: projectPath})
            })
            .then(() => {
                return git.add({fs, dir: projectPath, filepath: "."})
            })
            .then(() => {
                return git.commit({
                    fs,
                    dir: projectPath,
                    message: "Initial commit",
                    author: {
                        name: "PluginBlueprint",
                        email: "git@pluginblueprint.net"
                    }
                })
            })
            .then((sha) => {
                console.info("Created Initial commit:", sha);
                resolve(sha);
            })
            .catch(reject);
    })
}

function openOrInit(projectPath) {
    return new Promise((resolve, reject) => {
        git.listFiles({fs, dir: projectPath}).then((files) => {
            console.log("git files:", files);
            if (!files || files.length === 0) {// no repo here
                init(projectPath).then(resolve).catch(reject);
            } else {
                resolve(files);
            }
        });
    })
}

function addAllAndCommit(projectPath, project, msg) {
    return new Promise((resolve, reject) => {
        git.statusMatrix({fs, dir: projectPath})
            .then((status) => {// https://isomorphic-git.org/docs/en/snippets#git-add-a-
                return Promise.all(
                    status.map(([filepath, , worktreeStatus]) =>
                        // isomorphic-git may report a changed file as unmodified, so always add if not removing
                        worktreeStatus ? git.add({fs, dir: projectPath, filepath: filepath}) : git.remove({fs, dir: projectPath, filepath: filepath})
                    )
                );
            })
            .then(() => {
                return git.commit({
                    fs,
                    dir: projectPath,
                    message: msg || "N/A",
                    author: {
                        name: project.gitUser ? project.gitUser : "PluginBlueprint",
                        email: project.gitUser ? project.gitUser : "git@pluginblueprint.net"
                    }
                })
            })
            .then((sha) => {
                console.log("New commit:", sha, msg);
                resolve(sha);
            }).catch(reject);
    })
}

function listRemotes(projectPath) {
    return git.listRemotes({fs, dir: projectPath})
}

function setRemote(projectPath, url) {
    return git.addRemote({fs, dir: projectPath, remote: "origin", url: url, force: true});
}

function push(projectPath, project) {
    return getOrRequestCredentials(project)
        .then((creds) => {
            return git.push({
                fs,
                dir: projectPath,
                http,
                onAuth: () => ({username: creds.u, password: creds.p})
            })
        })
}

function getOrRequestCredentials(project) {
    return Promise.resolve().then(() => {
        let credentialFile = path.join(app.getPath("userData"), "git-credentials.json");
        let service = "pluginblueprint-git-" + project.name;
        let credentials = {};
        let canEncrypt = safeStorage.isEncryptionAvailable();
        if (canEncrypt && fs.existsSync(credentialFile)) {
            credentials = JSON.parse(fs.readFileSync(credentialFile, "utf-8"));
            if (project.gitUser && credentials[service] && credentials[service][project.gitUser]) {
                return {
                    u: project.gitUser,
                    p: safeStorage.decryptString(Buffer.from(credentials[service][project.gitUser], "base64"))
                };
            }
        }
        return requestCredentials().then(c => {
            project.gitUser = c.u;
            if (canEncrypt) {
                if (!credentials[service]) credentials[service] = {};
                credentials[service][c.u] = safeStorage.encryptString(c.p).toString("base64");
                fs.writeFileSync(credentialFile, JSON.stringify(credentials), "utf-8");
            }
            return c;
        });
    });
}

function requestCredentials() {
    return new Promise((resolve, reject) => {
        prompt({
            title: "Git Username",
            label: "Username",
            height: 150
        }).then((u) => {
            if (!u) {
                reject("missing username");
            } else {
                prompt({
                    title: "Git Password",
                    label: "Password",
                    height: 150,
                    inputAttrs: {
                        type: "password"
                    }
                }).then((p) => {
                    if (!p) {
                        reject("missing password")
                    } else {
                        resolve({
                            u: u,
                            p: p
                        });
                    }
                })
            }
        })
    })
}

module.exports = {init, openOrInit, addAllAndCommit, listRemotes, setRemote, push, getOrRequestCredentials};