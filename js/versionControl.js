const Git = require("nodegit");
const path = require("path");
const prompt = require("electron-prompt");
const keytar = require("keytar");
const {copyFile} = require("./util");

function init(projectPath) {
    return new Promise((resolve, reject) => {

        // based on https://github.com/nodegit/nodegit/blob/master/examples/create-new-repo.js
        let repository;
        let index;
        copyFile(path.join(__dirname, "../assets/projectGitignore.txt"), path.join(projectPath, ".gitignore"))
            .then(() => {
                return Git.Repository.init(projectPath, 0)
            })
            .then((repo) => {
                repository = repo;
                return repo.refreshIndex();
            })
            .then((idx) => {
                index = idx;
            })
            .then(() => {
                return index.addAll();
            })
            .then(() => {
                return index.write();
            })
            .then(() => {
                return index.writeTree();
            })
            .then((oid) => {
                let authorAndCommitter = Git.Signature.default(repository);
                return repository.createCommit("HEAD", authorAndCommitter, authorAndCommitter, "Initial commit", oid, []);
            })
            .then((commitId) => {
                console.info("Created Initial commit:", commitId);
                resolve(repository);
            })
            .catch(reject);
    })
}

function openOrInit(projectPath) {
    return new Promise((resolve, reject) => {
        Git.Repository.open(projectPath).then((repo) => {
            resolve(repo);
        }).catch((err) => {
            console.warn(err);
            init(projectPath).then((repo) => {
                resolve(repo);
            }).catch(reject);
        })
    })
}

function addAllAndCommit(projectPath, msg) {
    return new Promise((resolve, reject) => {
        // based on https://github.com/nodegit/nodegit/blob/master/examples/add-and-commit.js
        let repository;
        let index;
        let oid;
        Git.Repository.open(projectPath)
            .then(repo => {
                repository = repo;
                return repo.refreshIndex();
            })
            .then((idx) => {
                index = idx;
            })
            .then(() => {
                return index.addAll();
            })
            .then(() => {
                return index.write();
            })
            .then(() => {
                return index.writeTree();
            })
            .then((oidR) => {
                oid = oidR;
                return Git.Reference.nameToId(repository, "HEAD");
            })
            .then((head) => {
                return repository.getCommit(head);
            })
            .then((parent) => {
                let authorAndCommitter = Git.Signature.default(repository);
                return repository.createCommit("HEAD", authorAndCommitter, authorAndCommitter, msg || "", oid, [parent]);
            })
            .then((commitId) => {
                console.log("New commit:", commitId, msg);
                resolve(repository);
            })
            .catch(reject);
    })
}

function getOrRequestCredentials(project, repo) {
    return new Promise((resolve, reject) => {
        if (project && project.gitUser) {
            keytar.getPassword("pluginblueprint-git-" + project.name, project.gitUser).then(p => {
                resolve(Git.Cred.userpassPlaintextNew(project.gitUser, p));
            })
        } else {
            requestCredentials(repo).then(c => {
                project.gitUser = c.u;
                keytar.setPassword("pluginblueprint-git-" + project.name, c.u, c.p).then(() => {
                    resolve(Git.Cred.userpassPlaintextNew(c.u, c.p));
                })
            }).catch(reject);
        }
    })
}


function requestCredentials(repo) {
    return new Promise((resolve, reject) => {
        let defaultSignature = Git.Signature.default(repo);
        prompt({
            title: "Git Username",
            label: "Username",
            height: 150,
            value: defaultSignature ? defaultSignature.email || defaultSignature.name : null
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

module.exports = {init, openOrInit, addAllAndCommit, getOrRequestCredentials};