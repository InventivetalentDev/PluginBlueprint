const git = require("isomorphic-git");
const fs = require("fs");
git.plugins.set("fs", fs);
const path = require("path");
const prompt = require("electron-prompt");
const keytar = require("keytar");
const {copyFile} = require("./util");

function init(projectPath) {
    return new Promise((resolve, reject) => {
        copyFile(path.join(__dirname, "../assets/projectGitignore.txt"), path.join(projectPath, ".gitignore"))
            .then(() => {
                return git.init({dir: projectPath})
            })
            .then(() => {
               return git.add({dir:projectPath, filepath:"."})
            })
            .then(() => {
                return git.commit({
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
        git.listFiles({dir: projectPath}).then((files) => {
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
        git.statusMatrix({dir: projectPath})
            .then((status) => {// https://isomorphic-git.org/docs/en/snippets#git-add-a-
                return Promise.all(
                    status.map(([filepath, , worktreeStatus]) =>
                        // isomorphic-git may report a changed file as unmodified, so always add if not removing
                        worktreeStatus ? git.add({dir: projectPath, filepath: filepath}) : git.remove({dir: projectPath, filepath: filepath})
                    )
                );
            })
            .then(() => {
                return git.commit({
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
    return git.listRemotes({dir: projectPath})
}

function setRemote(projectPath, url) {
    return git.addRemote({dir: projectPath, remote: "origin", url: url, force: true});
}

function push(projectPath, project) {
    return getOrRequestCredentials(project)
        .then((creds) => {
            return git.push({
                dir: projectPath,
                username: creds.u,
                password: creds.p
            })
        })
}

function getOrRequestCredentials(project) {
    return new Promise((resolve, reject) => {
        if (project && project.gitUser) {
            keytar.getPassword("pluginblueprint-git-" + project.name, project.gitUser).then(p => {
                resolve({
                    u: project.gitUser,
                    p: p
                });
            })
        } else {
            requestCredentials().then(c => {
                project.gitUser = c.u;
                keytar.setPassword("pluginblueprint-git-" + project.name, c.u, c.p).then(() => {
                    resolve({
                        u: c.u,
                        p: c.p
                    });
                })
            }).catch(reject);
        }
    })
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