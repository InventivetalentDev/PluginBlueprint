const {app, BrowserWindow, ipcMain, dialog, Notification, shell, crashReporter} = require('electron');
const {LiteGraph} = require("litegraph.js");
const NodeGenerator = require("./js/nodeGenerator");
const CodeGenerator = require("./js/codeGenerator");
const javaCompiler = require("./js/javaCompiler");
const serverStarter = require("./js/serverStarter");
const googleAnalytics = require("./js/analytics");
const versionControl = require("./js/versionControl");
const prompt = require("electron-prompt");
const path = require("path");
const fs = require("fs-extra");
const notifier = require("node-notifier");
const request = require("request");
const Sentry = require("@sentry/electron");
const ProgressBar = require('electron-progressbar');
const {copyFile} = require("./js/util");
const AdmZip = require("adm-zip");
const RPC = require("discord-rich-presence");

const DEFAULT_TITLE = "PluginBlueprint Editor";
const APP_MODEL_ID = "inventivetalent.PluginBlueprint";

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let logWin;
let errWin;
let editorWin;
let commandWin;
let libraryWin;

let richPresence;

let debug = false;

let currentProject;
let currentProjectPath;
let isNewProject;

let recentProjects = [];

function init() {
    console.log("" +
        "PluginBlueprint, Version " + app.getVersion() + "\n" +
        "Copyright (c) 2018, Haylee Schaefer\n" +
        "All rights reserved.\n");

    crashReporter.start({
        productName: "PluginBlueprint",
        companyName: "inventivetalent",
        submitURL: "https://submit.backtrace.io/inventivetalent/194573923afb55a5b91ad7cda2868bbefaf0df605ae377a7067af7bd44f88e27/minidump",
        uploadToServer: true
    });
    Sentry.init({
        release: "PluginBlueprint@" + app.getVersion(),
        dsn: 'https://6d56f92bc4f84e44b66950ed04e92704@sentry.io/1309246'
    });

    console.log(process.argv);
    process.argv.forEach((val, index) => {
        if (val === "--debug") {
            debug = true;
            console.log("Debugging enabled");
        }
    });

    // Create the browser window.
    win = new BrowserWindow({
        title: DEFAULT_TITLE + " " + app.getVersion(),
        width: 1200,
        height: 800,
        show: false,
        icon: path.join(__dirname, 'assets/images/favicon.ico'),
        backgroundColor: "#373737",
    });

    googleAnalytics.init().then(analytics => {
        analytics.set("ds", "app");
        analytics.set("debugEnabled", debug);
        analytics.set("appVersion", app.getVersion());

        showWindow();
    });
}

function showWindow() {
    app.unsavedChanges = 0;
    app.uncompiledChanges = 0;

    // and load the index.html of the app.
    win.loadFile('index.html');
    win.once('ready-to-show', () => {
        win.show();

        // Open the DevTools.
        if (debug) {
            win.webContents.openDevTools({
                mode: "detach"
            });
        }

        checkFileAssociation();
        updateRichPresence();
        global.analytics.screenview("Home", app.getName(), app.getVersion()).send();
    });

    win.on("close", function (e) {
        if (app.unsavedChanges > 0) {
            let c = dialog.showMessageBox({
                type: "question",
                message: "You have " + app.unsavedChanges + " unsaved changes. Are you sure you want to exit?",
                buttons: ["Yes", "No"],
                icon: path.join(__dirname, 'assets/images/logo-x64.png')
            });
            if (c === 1) {
                e.preventDefault();
            }
        }
        serverStarter.killInstance();
        logWin = null;
    });

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });

    readRecentProjects();

    // Init Discord Rich Presence
    richPresence = RPC("532503320108072960");
    richPresence.on("error", (err) => {
        console.warn(err);
        global.analytics.event("DiscordRPC", "failed").send();
    });
    richPresence.on("connected", () => {
        global.analytics.event("DiscordRPC", "connected").send();
    });
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        init()
    }
});

process.on('uncaughtException', function (error) {
    console.error(error);
    Sentry.captureException(error);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function checkFileAssociation() {
    app.setAppUserModelId(APP_MODEL_ID);
    if (process.platform === 'win32' && process.argv.length >= 2) {
        let p = process.argv[1];
        if (p && p.length > 1) {
            openProject(path.dirname(p));
        }
    }
}

function readRecentProjects() {
    let recentProjectFile = path.join(app.getPath("userData"), "recentProjects.pbd");
    if (!fs.existsSync(recentProjectFile)) {
        return;
    }
    fs.readFile(recentProjectFile, function (err, data) {
        if (err) {
            console.warn(err);
            Sentry.captureException(err);
            return;
        }
        data = JSON.parse(data);

        let promises = [];
        for (let i = 0; i < data.length; i++) {
            promises.push(new Promise(resolve => {
                fs.readFile(path.join(data[i], "project.pbp"), function (err, projectData) {
                    if (err) {
                        console.warn(err);
                        resolve({});
                        return;
                    }
                    projectData = JSON.parse(projectData);

                    fs.readFile(path.join(data[i], "thumb.pbt"), "base64", function (err, thumb) {
                        if (err) console.warn(err);
                        resolve({
                            path: data[i],
                            name: projectData.name,
                            editorVersion: projectData.editorVersion,
                            thumbnail: thumb
                        })
                    })
                })
            }));
        }

        Promise.all(promises).then((projects) => {
            projects = projects || [];
            recentProjects = projects.filter(p => p && p.path);

            if (win) {
                win.webContents.send("recentProjects", recentProjects);
            }
            updateJumpList();
        })
    });
}

function writeRecentProjects() {
    if (recentProjects.length > 10) {
        recentProjects.pop();
    }
    let paths = [];
    for (let i = 0; i < recentProjects.length; i++) {
        paths.push(recentProjects[i].path);
    }
    fs.writeFile(path.join(app.getPath("userData"), "recentProjects.pbd"), JSON.stringify(paths), "utf-8", function (err) {
        if (err) {
            console.warn(err);
            Sentry.captureException(err);
        }
    });
}

ipcMain.on("getRecentProjects", function (event, arg) {
    event.sender.send("recentProjects", recentProjects || []);
});

function updateJumpList() {
    if (!app.isPackaged || process.platform !== 'win32') return;// Won't recent projects won't work properly if the app is running from the electron.exe wrapper
    let recentProjectItems = [];
    for (let i = 0; i < recentProjects.length; i++) {
        recentProjectItems.push({
            type: "task",
            title: recentProjects[i].name,
            description: "Open " + recentProjects[i].name,
            program: process.execPath,
            args: path.join(recentProjects[i].path, "project.pbp")
        })
    }
    app.setJumpList([
        {
            type: "custom",
            name: "Recent Projects",
            items: recentProjectItems
        }
    ])
}

function updateRichPresence() {
    if (richPresence) {
        if (currentProjectPath && currentProject) {
            richPresence.updatePresence({
                state: "Blueprinting",
                details: "Editing " + currentProject.name,
                largeImageKey: "large_default",
                startTimestamp: Date.now(),// TODO: probably inaccurate to always use the current time
            })
        } else {
            richPresence.updatePresence({
                state: "In Project Selection",
                largeImageKey: "large_gray",
                startTimestamp: Date.now(),// TODO: probably inaccurate to always use the current time
            })
        }
    }
}

ipcMain.on("openGraph", function (event, arg) {
    if (win) {
        win.loadFile('pages/graph.html');
    }
});

ipcMain.on("showCreateNewProject", function (event, arg) {
    let projectPath = dialog.showOpenDialog({
        properties: ["openDirectory"]
    });
    console.log(projectPath);

    if (!projectPath || projectPath.length === 0) {
        return;
    }
    if (Array.isArray(projectPath)) {
        projectPath = projectPath[0];
        if (!projectPath || projectPath.length === 0) {
            return;
        }
    }
    let pathSplit = projectPath.split("\\");

    try {
        global.analytics.event("Project", "Start creating new").send();
    } catch (e) {
        console.warn(e);
    }

    let name = pathSplit[pathSplit.length - 1];
    prompt({
        title: "Give your project a name",
        label: "Project Name",
        value: name,
        height: 150
    }).then((r) => {
        if (r) {
            name = r;
            console.log(name);

            dialog.showMessageBox({
                title: "Select spigot.jar location",
                message: "Please select the location of a valid Spigot or Paper Server executable (usually spigot.jar)",
                buttons: ["Select", "I don't have one"],
                icon: path.join(__dirname, 'assets/images/logo-x64.png')
            }, (r) => {
                console.log(r);
                if (r === 0) {
                    let libPath = dialog.showOpenDialog({
                        properties: ["openFile"],
                        filters: [
                            {name: 'Spigot JAR file', extensions: ['jar']}
                        ]
                    });
                    console.log(libPath);
                    if (!libPath || libPath.length === 0) {
                        return;
                    }
                    if (Array.isArray(libPath)) {
                        libPath = libPath[0];
                        if (!libPath || libPath.length === 0) {
                            return;
                        }
                    }

                    createNewProject({
                        path: projectPath,
                        name: name
                    }, libPath)
                } else {
                    shell.openExternal("https://www.spigotmc.org/wiki/buildtools/#running-buildtools");
                }
            });


        }
    })
});

function createNewProject(arg, lib) {
    let projectFilePath = path.join(arg.path, "project.pbp");
    if (fs.existsSync(projectFilePath)) {
        dialog.showErrorBox("Project exists", "There is already a PluginBlueprint project in that directory");
        return;
    }

    let progressBar = new ProgressBar({
        indeterminate: false,
        text: "Creating Project...",
        detail: "Creating Project...",
        maxValue: 5
    });

    let projectInfo = {
        name: arg.name,
        creationTime: Date.now(),
        description: "My Awesome Plugin!!",
        author: "inventivetalent",
        package: "my.awesome.plugin",
        version: "0.0.0",
        type: "spigot",
        lastSave: 0,
        lastCompile: 0,
        editorVersion: app.getVersion(),
        buildNumber: 0,
        debug: true
    };

    progressBar.on("ready", function () {
        progressBar.detail = "Creating project files...";

        setTimeout(function () {
            fs.writeFile(projectFilePath, JSON.stringify(projectInfo), "utf-8", (err) => {
                progressBar.value++;
                if (err) {
                    console.error("Failed to create project file");
                    console.error(err);
                    dialog.showErrorBox("Error", "Failed to create PluginBlueprint project in that directory");
                    Sentry.captureException(err);
                    return;
                }
                currentProjectPath = arg.path;
                currentProject = projectInfo;
                isNewProject = true;

                // Create dummy file with project name
                // (symlink would be nicer but requires admin perms)
                fs.writeFileSync(path.join(currentProjectPath, currentProject.name + ".pbp"), projectFilePath, "utf-8");

                fs.mkdirSync(path.join(arg.path, "src"));
                fs.mkdirSync(path.join(arg.path, "classes"));
                fs.mkdirSync(path.join(arg.path, "output"));
                fs.mkdirSync(path.join(arg.path, "lib"));

                progressBar.detail = "Copying server .jar file...";

                let rs = fs.createReadStream(lib);
                let ws = fs.createWriteStream(path.join(currentProjectPath, "lib", "spigot.jar"));
                ws.on("close", function () {
                    progressBar.value++;
                    progressBar.detail = "Setting up graph file...";

                    fs.writeFile(path.join(arg.path, "graph.pbg"), JSON.stringify({}), "utf-8", (err) => {
                        progressBar.value++;
                        if (err) {
                            console.error("Failed to create graph file");
                            console.error(err);
                            Sentry.captureException(err);
                            return;
                        }

                        recentProjects.unshift({
                            path: currentProjectPath,
                            name: currentProject.name,
                            editorVersion: currentProject.editorVersion
                        });
                        writeRecentProjects();

                        app.addRecentDocument(path.join(currentProjectPath, currentProject.name + ".pbp"));
                        updateJumpList();

                        progressBar.detail = "Creating initial commit...";

                        versionControl.init(currentProjectPath).then(repo => {
                            progressBar.value++;
                            console.log(repo);

                            progressBar.detail = "Done!";

                            if (win) {
                                win.loadFile('pages/graph.html');
                                win.setTitle(DEFAULT_TITLE + " [" + currentProject.name + "]");
                                progressBar.value++;
                            }
                            updateRichPresence();
                            global.analytics.event("Project", "New created").send();
                        }).catch(err => {
                            console.error(err);
                            Sentry.captureException(err);
                        })
                    })
                });
                rs.pipe(ws);

            });
        }, 500);
    });
}

ipcMain.on("createNewProject", function (event, arg) {
    createNewProject(arg);
});


ipcMain.on("showOpenProject", function (event, arg) {
    try {
        global.analytics.event("Project", "Show File Selector").send();
    } catch (e) {
        console.warn(e);
    }

    let p = dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            {name: 'Plugin Blueprint Projects', extensions: ['pbp']}
        ]
    });
    console.log(p);

    if (!p || p.length === 0) {
        return;
    }
    if (Array.isArray(p)) {
        p = p[0];
        if (!p || p.length === 0) {
            return;
        }
    }
    p = path.dirname(p);

    openProject(p);
});

function openProject(arg) {
    console.log("openProject", arg);
    if (!arg || arg.length === 0) return;
    let projectFilePath = path.join(arg, "project.pbp");
    if (!fs.existsSync(projectFilePath)) {
        console.error("No project file found");
        dialog.showErrorBox("Not found", "Could not find a PluginBlueprint project in that directory");
        Sentry.captureException(err);
        return;
    }
    try {
        global.analytics.event("Project", "Open Project").send();
    } catch (e) {
        console.warn(e);
    }
    fs.readFile(projectFilePath, "utf-8", function (err, data) {
        if (err) {
            console.error("Failed to read project file");
            console.error(err);
            Sentry.captureException(err);
            return;
        }
        data = JSON.parse(data);


        function doOpen() {
            currentProjectPath = arg;
            currentProject = data;
            isNewProject = false;

            let i = recentProjects.map(function (e) {
                return e.path;
            }).indexOf(currentProjectPath);
            if (i !== -1) {
                recentProjects.splice(i, 1);
            }
            recentProjects.unshift({
                path: currentProjectPath,
                name: currentProject.name,
                editorVersion: currentProject.editorVersion
            });
            writeRecentProjects();

            app.addRecentDocument(path.join(currentProjectPath, currentProject.name + ".pbp"));
            updateJumpList();

            versionControl.openOrInit(currentProjectPath).then(repo => {
                console.log(repo);

                if (win) {
                    win.loadFile('pages/graph.html');
                    win.setTitle(DEFAULT_TITLE + " [" + currentProject.name + "]");
                }
                updateRichPresence();
                global.analytics.event("Project", "Open Project").send();
            }).catch(err => {
                console.error(err);
                Sentry.captureException(err);
            })
        }

        let appVersion = app.getVersion() || "x.x.x";
        let appVersionSplit = appVersion.split(".");
        let fileVersion = data.editorVersion || "y.y.y";
        let fileVersionSplit = fileVersion.split(".");
        if (appVersionSplit[1] !== fileVersionSplit[1]) {// compare minor version
            dialog.showMessageBox({
                type: "warning",
                title: "Different Editor Version",
                message: "The project you're trying to open was created using a different PluginBlueprint version.",
                detail: "It might not be compatible with the current version, so please proceed carefully and create a backup first. (Project Version: " + fileVersion + ", Editor Version: " + appVersion + ")",
                buttons: ["Proceed Anyway", "Open Project Directory to create backup", "Cancel"],
                defaultId: 1
            }, (r) => {
                console.log(r);
                if (r === 0) {// Proceed Anyway
                    doOpen();
                } else if (r === 1) {// Open directory
                    shell.openItem(arg);
                } else {// cancel
                }
            });
        } else {
            doOpen();
        }

    })
}

ipcMain.on("openProject", function (event, arg) {
    openProject(arg);
});

ipcMain.on("getProjectInfo", function (event, arg) {
    let proj = currentProject || {};
    proj.isNewProject = isNewProject;
    event.sender.send("projectInfo", proj);
});

ipcMain.on("updateProjectInfo", function (event, arg) {
    if (!arg) return;
    currentProject = arg;

    if (win) {
        win.setTitle(DEFAULT_TITLE + " [" + currentProject.name + "]");
        win.webContents.send("projectInfo", currentProject);
    }

    fs.writeFile(path.join(currentProjectPath, "project.pbp"), JSON.stringify(currentProject), "utf-8", function (err) {
        if (err) {
            console.error("Failed to write project file");
            console.error(err);
            Sentry.captureException(err);
            return;
        }
        updateRichPresence();
    })
});

ipcMain.on("getGraphData", function (event, arg) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    fs.readFile(path.join(currentProjectPath, "graph.pbg"), "utf-8", function (err, data) {
        if (err) {
            console.error("Failed to read graph file");
            console.error(err);
            Sentry.captureException(err);
            return;
        }

        event.sender.send("graphData", JSON.parse(data));

        if (isNewProject) {
            importSnippet(path.join(__dirname, "assets", "snippets", "onEnableLog.pbs"));
        }
    });
});

function saveGraphData(arg, cb) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    // backup
    copyFile(path.join(currentProjectPath, 'graph.pbg'), path.join(currentProjectPath, 'graph.pbg.old')).then(() => {
        // write data
        fs.writeFile(path.join(currentProjectPath, "graph.pbg"), JSON.stringify(arg), "utf-8", function (err) {
            if (err) {
                console.error("Failed to save graph file");
                console.error(err);
                Sentry.captureException(err);
                return;
            }

            saveProject(cb);
        })
    });
}

function saveProject(cb) {
    currentProject.lastSave = Date.now();
    fs.writeFile(path.join(currentProjectPath, "project.pbp"), JSON.stringify(currentProject), "utf-8", function (err) {
        if (err) {
            console.error("Failed to write project file");
            console.error(err);
            Sentry.captureException(err);
            return;
        }
        if (cb) cb();
    });
}

ipcMain.on("saveGraphData", function (event, arg) {
    console.log("saveGraphData");
    saveGraphData(arg, function () {
        event.sender.send("graphDataSaved")
    });
});


ipcMain.on("saveGraphDataAndClose", function (event, arg) {
    console.log("saveGraphData");
    saveGraphData(arg, function () {
        win.loadFile('index.html');
        win.setTitle(DEFAULT_TITLE);
        currentProject = null;
        currentProjectPath = null;
        app.unsavedChanges = 0;
        app.uncompiledChanges = 0;

        updateRichPresence();
    });
});

ipcMain.on("saveThumbnail", function (event, arg) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    let data = arg.replace(/^data:image\/\w+;base64,/, '');

    fs.writeFile(path.join(currentProjectPath, "thumb.pbt"), data, "base64", function (err) {
        let i = recentProjects.map(function (e) {
            return e.path;
        }).indexOf(currentProjectPath);
        if (i !== -1) {
            recentProjects[i].thumbnail = data;
        }
    });
});

function saveCodeToFile(code) {
    return new Promise((resolve, reject) => {
        console.log("saveCode: " + Date.now());
        if (!currentProject || !currentProjectPath) {
            return reject();
        }
        if (!code) return reject();

        try {
            global.analytics.event("Code", "Save to File").send();
        } catch (e) {
            console.warn(e);
        }

        fs.emptyDir(path.join(currentProjectPath, "src"), function (err) {
            fs.mkdirs(path.join(currentProjectPath, "src", currentProject.package.split(".").join("\\")), function (err) {
                if (err) {
                    console.error("Failed to save code file");
                    console.error(err);
                    Sentry.captureException(err);
                    return;
                }
                fs.writeFile(path.join(currentProjectPath, "src", currentProject.package.split(".").join("\\"), "GeneratedPlugin.java"), code, "utf-8", function (err) {
                    if (err) {
                        console.error("Failed to save code file");
                        console.error(err);
                        Sentry.captureException(err);
                        return;
                    }

                    console.log("savedCode: " + Date.now());

                    let manifest = "Generated-By: PluginBlueprint " + app.getVersion() + "\n";
                    fs.writeFile(path.join(currentProjectPath, "src", "manifest"), manifest, "utf-8", function (err) {
                        if (err) {
                            console.error("Failed to save manifest file");
                            console.error(err);
                            Sentry.captureException(err);
                            return;
                        }

                        resolve();
                    });
                });
            });
        })
    })

}

function makePluginYml() {
    if (!currentProject.buildNumber) currentProject.buildNumber = 0;
    let yml = "name: " + currentProject.name +
        "\ndescription: " + currentProject.description +
        "\nversion: " + currentProject.version + (currentProject.debug ? ("-b" + ++currentProject.buildNumber) : "") +
        "\nmain: " + currentProject.package + ".GeneratedPlugin" +
        "\nauthor: " + currentProject.author +
        "\nsoftdepend: [" + (currentProject.softdepend || []).join(",") + "]" +
        "\ngenerator: PluginBlueprint " + app.getVersion() +
        "\napi-version: 1.13\n";
    if (currentProject.commands) {
        yml += "commands:\n";
        for (let i = 0; i < currentProject.commands.length; i++) {
            yml += "  " + currentProject.commands[i].name + ":\n";
            yml += "    description: " + currentProject.commands[i].description + "\n";
            yml += "    usage: " + currentProject.commands[i].usage + "\n";
        }
    }
    return yml;
}

function compile() {
    return new Promise((resolve, reject) => {
        try {
            global.analytics.event("Code", "Compile").send();
        } catch (e) {
            console.warn(e);
        }

        javaCompiler.testForJavac().then(() => {
            console.log("compile: " + Date.now());
            fs.emptyDir(path.join(currentProjectPath, "classes"), function (err) {
                javaCompiler.compile(currentProjectPath, currentProject).then((result) => {
                    let pluginYml = makePluginYml();
                    fs.writeFile(path.join(currentProjectPath, "classes", "plugin.yml"), pluginYml, function (err) {
                        console.log("compiled: " + Date.now());
                        currentProject.lastCompile = Date.now();
                        resolve();
                    })
                }).catch(reject);
            });
        }).catch(() => {
            dialog.showErrorBox("javac not found", "Could not find javac executable. Please download the Java Development Kit and make sure javac is in your Environment Variables. (See https://yeleha.co/pb-jdk for details)");
        })
    })
}

function pack() {
    return new Promise((resolve, reject) => {
        try {
            global.analytics.event("Code", "Pack").send();
        } catch (e) {
            console.warn(e);
        }

        console.log("package: " + Date.now());
        fs.emptyDir(path.join(currentProjectPath, "output"), function (err) {
            javaCompiler.package(currentProjectPath, currentProject).then(() => {
                console.log("packaged: " + Date.now());
                resolve();
            }).catch(reject);
        });
    })
}

function showCustomErrorDialog(error, title, message) {
    if (errWin) errWin.destroy();
    errWin = null;

    errWin = new BrowserWindow({
        parent: win,
        width: 1000,
        height: 600,
        modal: false,
        show: false,
        resizable: true,
        backgroundColor: "#373737",
        icon: path.join(__dirname, 'assets/images/favicon.ico')
    });
    errWin.setMenu(null);
    errWin.setTitle(title || "An Error occurred!");
    errWin.loadFile('pages/error.html');
    errWin.theError = error;
    errWin.theMessage = message;
    errWin.show();
    // Open the DevTools.
    if (debug) {
        errWin.webContents.openDevTools({
            mode: "detach"
        });
    }
}

ipcMain.on("codeGenerated", function (event, arg) {
    let max = 0;
    if (arg.code) max++;
    if (arg.compile) max++;
    if (arg.pack) max++;
    let progressBar = new ProgressBar({
        indeterminate: false,
        maxValue: max,
        text: "Generating/Compiling/Packaging...",
        detail: "Waiting..."
    });

    progressBar.on("ready", function () {
        setTimeout(function () {
            generateCompilePackage(arg, progressBar).then(() => {
                progressBar.detail = "Done!";
                console.log("Done!");
                showNotification("Done!");
                event.sender.send("generateDone");
            }).catch((err) => {
                progressBar.detail = "Error";
                event.sender.send("generateError", err);
                showCustomErrorDialog(err, "Compilation Error");
                progressBar.close();
            })
        }, 500);
    });
});

// async/await to preserve execution order
async function generateCompilePackage(arg, progressBar) {
    if (arg.code) {
        progressBar.detail = "Generating code...";
        await saveCodeToFile(arg.code);
        progressBar.value++;
    }
    if (arg.compile) {
        progressBar.detail = "Compiling...";
        await compile();
        progressBar.value++;
    }
    if (arg.pack) {
        progressBar.detail = "Packaging...";
        await pack();
        progressBar.value++;
    }
}

ipcMain.on("openOutputDir", function (event, arg) {
    shell.openItem(path.join(currentProjectPath, "output"));
    global.analytics.event("Project", "Open Output Directory").send();
});

ipcMain.on("openProjectInfoEditor", function (event, arg) {
    console.log("openProjectInfoEditor");
    let child = new BrowserWindow({
        parent: win,
        title: DEFAULT_TITLE,
        width: 600,
        height: 800,
        modal: true,
        show: false,
        resizable: false,
        backgroundColor: "#373737",
        icon: path.join(__dirname, 'assets/icons/favicon.ico')
    });
    editorWin = child;
    child.on("close", () => {
        editorWin = null;
    });
    child.loadFile('pages/infoEditor.html');
    child.show();
    global.analytics.screenview("Info Editor", app.getName(), app.getVersion()).event("Project", "Open Info Editor").send();
});

ipcMain.on("openCommandEditor", function (event, arg) {
    console.log("openCommandEditor");
    let child = new BrowserWindow({
        parent: win,
        title: DEFAULT_TITLE,
        width: 600,
        height: 500,
        modal: true,
        show: false,
        resizable: false,
        backgroundColor: "#373737",
        icon: path.join(__dirname, 'assets/icons/favicon.ico')
    });
    child.custom = {
        command: arg.command,
        index: arg.index
    };
    commandWin = child;
    child.on("close", () => {
        commandWin = null;
    });
    child.loadFile('pages/commandEditor.html');
    child.show();
    global.analytics.screenview("Command Editor", app.getName(), app.getVersion()).event("Project", "Open Command Editor").send();
});

ipcMain.on("saveCommand", function (event, arg) {
    if (editorWin) {
        if (arg.isNew) {
            editorWin.webContents.send("commandAdded", arg.command);
        } else {
            editorWin.webContents.send("commandUpdated", {
                command: arg.command,
                index: arg.index
            })
        }
    }
});

ipcMain.on("startServer", function (event, arg) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    if (logWin) logWin.destroy();
    logWin = null;
    serverStarter.killInstance();

    if (!fs.existsSync(path.join(currentProjectPath, "output", currentProject.name + ".jar"))) {
        dialog.showErrorBox("Error", "Please compile your plugin first!");
        return;
    }

    if (serverStarter.isRunning()) {
        dialog.showErrorBox("Error", "Please wait for the existing server to shut down and try again");
        return;
    }

    logWin = new BrowserWindow({
        parent: win,
        width: 800,
        height: 1000,
        modal: false,
        show: false,
        resizable: true,
        backgroundColor: "#373737",
        icon: path.join(__dirname, 'assets/images/favicon.ico')
    });
    logWin.setMenu(null);
    logWin.setTitle("PluginBlueprint Test Server");
    logWin.loadFile('pages/log.html');
    logWin.show();
    try {
        global.analytics.screenview("Server Log", app.getName(), app.getVersion()).event("Project", "Start Server").send();
    } catch (e) {
        console.warn(e);
    }
    // Open the DevTools.
    if (debug) {
        logWin.webContents.openDevTools({
            mode: "detach"
        });
    }
    let port = "";
    serverStarter.copyPlugin(currentProjectPath, currentProject).then(() => {
        serverStarter.startServer(currentProjectPath,
            (out) => {
                if (logWin) {
                    // sometimes multiple lines are combined into one output, so split it here
                    let split = out.split("\n");
                    for (let i = 0; i < split.length; i++) {
                        let log = split[i];

                        if (log.indexOf("Starting Minecraft server on") !== -1) {
                            port = log.substr(24/* strip timestamp & start of string */).split(":")[1];
                        }
                        if (log.indexOf("Done (") !== -1 && log.indexOf("For help, type") !== -1) {
                            showNotification("Test Server running on port " + port);
                        }


                        if (log.indexOf("pb_debug_exec") !== -1) {
                            if (win) win.webContents.send("debugCall", {
                                type: "exec",
                                node: parseInt(log.split("pb_debug_exec=")[1])
                            });
                            continue;// don't log
                        }

                        let logData = {
                            type: "out",
                            content: log
                        };
                        if (log.indexOf("Caused by:") === 0) {
                            logData.href = "https://www.google.com/search?q=" + log;
                        }
                        if (log.indexOf(currentProject.package) !== -1) {
                            if (log.indexOf("node_") !== -1) {
                                logData.hasNode = true;

                                if (win) win.webContents.send("logError", log);
                            }
                        }

                        logWin.webContents.send("log", logData);
                    }
                }
            },
            (err) => {
                if (logWin) {
                    logWin.webContents.send("log", {
                        type: "err",
                        content: err
                    })
                }
            });
    })
});

ipcMain.on("sendServerCommand", function (event, arg) {
    serverStarter.sendCommandToInstance(arg);
});

ipcMain.on("stopServer", function (event, arg) {
    if (logWin) logWin.destroy();
    logWin = null;
    serverStarter.killInstance();
});

ipcMain.on("reloadPlugin", function (event, arg) {
    reloadPlugin();
});

function reloadPlugin() {
    if (!currentProject) return;
    console.log("Reloading plugin...");
    serverStarter.sendCommandToInstance("pluginblueprint unload " + currentProject.name, () => {
        serverStarter.copyPlugin(currentProjectPath, currentProject, true, true, true).then(() => {
            serverStarter.sendCommandToInstance("pluginblueprint load " + currentProject.name, () => {
                console.log("Plugin reloaded!");
                showNotification("Plugin reloaded!");
            })
        })
    });
    global.analytics.event("Project", "Reload Plugin").send();
}

ipcMain.on("highlightNode", function (event, arg) {
    if (win) {
        win.webContents.send("highlightNode", arg);
    }
});

ipcMain.on("showExportDialog", function (event, arg) {
    console.log("showExportDialog");
    showExportDialog();
});

function showExportDialog() {
    if (!currentProject || !currentProjectPath) return;
    dialog.showSaveDialog(win, {
        defaultPath: path.join(currentProjectPath, currentProject.name + ".zip"),
        filters: [{
            name: "ZIP File",
            extensions: ["zip"]
        }]
    }, (file) => {
        if (!file) return;
        exportProject(file);
    })
}

function exportProject(output) {
    if (!currentProject || !currentProjectPath) return;
    let zip = new AdmZip();
    zip.addLocalFile(path.join(currentProjectPath, "project.pbp"));
    zip.addLocalFile(path.join(currentProjectPath, "graph.pbg"));
    zip.writeZip(output);
    global.analytics.event("Project", "Export").send();
}

ipcMain.on("exportSnippet", function (event, arg) {
    dialog.showSaveDialog(win, {
        defaultPath: path.join(currentProjectPath, currentProject.name + "-snippet.pbs"),
        filters: [{
            name: "PluginBlueprint Snippet",
            extensions: ["pbs"]
        }]
    }, (file) => {
        if (!file) return;
        fs.writeFile(file, JSON.stringify(arg), function (err) {
            if (err) throw err;
        })
    })
});

ipcMain.on("showImportSnippet", function (event, arg) {
    dialog.showOpenDialog(win, {
        defaultPath: currentProjectPath,
        filters: [{
            name: "PluginBlueprint Snippet",
            extensions: ["pbs"]
        }]
    }, (files) => {
        if (!files || files.length === 0) return;
        importSnippet(files[0]);
    });
});

function importSnippet(file) {
    if (!file) {
        return;
    }
    fs.readFile(file, function (err, data) {
        if (err) throw err;
        if (!win) return;
        win.webContents.send("importSnippet", JSON.parse(data));
    });
}

ipcMain.on("gitAddAndCommit", function (event, arg) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        prompt({
            title: "Enter a commit message",
            label: "Commit Message",
            height: 150,
            value: "Update things!"
        }).then((r) => {
            if (r) {
                versionControl.addAllAndCommit(currentProjectPath, currentProject, r).then(repo => {
                    showNotification("Committed '" + r + "'");
                    event.sender.send("committed");
                }).catch((err) => {
                    console.error(err);
                    dialog.showErrorBox("Error", err ? err.message : err);
                    Sentry.captureException(err);
                    event.sender.send("committed");//TODO: might need a different channel
                })
            } else {
                event.sender.send("committed");//TODO: might need a different channel
            }
        });
    })
});

ipcMain.on("gitPush", function (event, arg) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        versionControl.listRemotes(currentProjectPath).then(remotes => {
            if (!remotes || remotes.length === 0) {
                dialog.showErrorBox("Missing Remote", "Please configure a remote first");
            } else {
                saveProject(() => {
                    versionControl.push(currentProjectPath, currentProject).then((pushResponse) => {
                        console.log(pushResponse);
                        showNotification("Pushed to origin");
                        event.sender.send("pushed");//TODO: different event
                    }).catch(err => {
                        console.error(err);
                        dialog.showErrorBox("Error", err ? err.message : err);
                        Sentry.captureException(err);
                        event.sender.send("pushed");//TODO: different event
                    });

                })
            }
        });
    });
});

ipcMain.on("gitChangeRemote", function (event, arg) {
    if (!currentProjectPath || !currentProject) return;
    versionControl.openOrInit(currentProjectPath).then(() => {
        versionControl.listRemotes(currentProjectPath).then(remotes => {
            prompt({
                title: "Change Remote",
                label: "Remote URL",
                height: 150,
                value: remotes && remotes.length > 0 ? remotes[0].url : null
            }).then((r) => {
                if (r) {
                    versionControl.setRemote(currentProjectPath, r).then(() => {
                        showNotification("Remote changed to " + r);
                        event.sender.send("remoteChanged");
                    }).catch((err) => {
                        console.error(err);
                        dialog.showErrorBox("Error", err ? err.message : err);
                        Sentry.captureException(err);
                        event.sender.send("remoteChanged");// TODO: different event
                    });
                } else {
                    event.sender.send("remoteChanged");
                }
            });
        });
    });
});

ipcMain.on("showLibrarySelector", function (event) {
    let child = new BrowserWindow({
        parent: win,
        title: DEFAULT_TITLE,
        width: 600,
        height: 300,
        modal: true,
        show: false,
        resizable: false,
        backgroundColor: "#373737",
        icon: path.join(__dirname, 'assets/icons/favicon.ico')
    });
    libraryWin = child;
    child.on("close", () => {
        libraryWin = null;
    });
    child.loadFile('pages/librarySelector.html');
    if (debug) {
        child.webContents.openDevTools({
            mode: "detach"
        });
    }
    child.show();
    global.analytics.screenview("Library Selector", app.getName(), app.getVersion()).event("Project", "Open Library Selector").send();
});

ipcMain.on("addLibrary", function (event, arg) {
    console.log("addLibrary", arg);
    if (!currentProject) return;
    if (!currentProject.libraries) currentProject.libraries = [];
    if (currentProject.libraries.indexOf(arg) === -1) {
        currentProject.libraries.push(arg);
    }
    saveProject(function () {
        if (win) {
            win.webContents.send("libraryAdded", arg);
        }
    });
});

ipcMain.on("checkUpdate", function (event) {
    checkUpdate().then(u => {
        event.sender.send("updateInfo", u);
    })
});

function checkUpdate() {
    return new Promise(resolve => {
        request("https://pluginblueprint.net/checkupdate.php", function (err, res, body) {
            if (err || !body || body.length > 10/* invalid response content */) {
                resolve({
                    hasUpdate: false
                });
                return;
            }
            let currentVersion = app.getVersion();
            resolve({
                hasUpdate: body > currentVersion,
                appVersion: currentVersion,
                updateVersion: body
            })
        })
    });
}

function showNotification(body, title) {

    notifier.notify({
        appName: "org.inventivetalent.pluginblueprint",
        title: title || "PluginBlueprint",
        message: body || "-message-",
        icon: path.join(__dirname, "assets/images/PluginBlueprint-x512.png"),
        sound: false
    }, function (err, res) {
        console.log(err);
        console.log(res);
    });
    // }

    return {
        close: function () {
        }
    }
}
