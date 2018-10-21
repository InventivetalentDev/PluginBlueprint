const {app, BrowserWindow, ipcMain, dialog, Notification, shell} = require('electron');
const {LiteGraph} = require("litegraph.js");
const NodeGenerator = require("./nodeGenerator");
const CodeGenerator = require("./codeGenerator");
const javaCompiler = require("./javaCompiler");
const prompt = require("electron-prompt");
const path = require("path");
const fs = require("fs-extra");
const notifier = require("node-notifier");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let currentProject;
let currentProjectPath;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        title: "PluginBlueprint Editor",
        width: 800,
        height: 600,
        show: false,
        icon: path.join(__dirname, 'assets/icons/favicon.ico')
    })


    // and load the index.html of the app.
    win.loadFile('index.html');
    win.once('ready-to-show', () => {
        win.show()

        // Open the DevTools.
        win.webContents.openDevTools();

        checkFileAssociation();
    })

    win.on("close", function (e) {
        let c = dialog.showMessageBox({
            message: "Are you sure you want to exit?",
            buttons: ["Yes", "No"]
        })
        if (c === 1) {
            e.preventDefault();
        }
    })

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function checkFileAssociation() {
    if (process.platform === 'win32' && process.argv.length >= 2) {
        let p=process.argv[1];
        if (p && p.length > 1) {
            openProject(path.dirname(p));
        }
    }
}

ipcMain.on("openGraph", function (event, arg) {
    if (win) {
        win.loadFile('graph.html');
    }
});

ipcMain.on("showCreateNewProject", function (event, arg) {
    let path = dialog.showOpenDialog({
        properties: ["openDirectory"]
    })
    console.log(path);

    if (!path || path.length === 0) {
        return;
    }
    if (Array.isArray(path)) {
        path = path[0];
        if (!path || path.length === 0) {
            return;
        }
    }
    let pathSplit = path.split("\\");

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

            createNewProject({
                path: path,
                name: name
            })
        }
    })
});

function createNewProject(arg) {
    let projectFilePath = path.join(arg.path, "project.pbp");
    if (fs.existsSync(projectFilePath)) {
        dialog.showErrorBox("Project exists", "There is already a PluginBlueprint project in that directory");
        return;
    }
    let projectInfo = {
        name: arg.name,
        creationTime: Date.now()
    };
    fs.writeFile(projectFilePath, JSON.stringify(projectInfo), "utf-8", (err) => {
        if (err) {
            console.error("Failed to create project file");
            console.error(err);
            dialog.showErrorBox("Error", "Failed to create PluginBlueprint project in that directory");
            return;
        }
        currentProjectPath = arg.path;
        currentProject = projectInfo;

        fs.mkdirSync(path.join(arg.path, "src"));
        fs.mkdirSync(path.join(arg.path, "classes"));
        fs.mkdirSync(path.join(arg.path, "output"));
        fs.writeFile(path.join(arg.path, "graph.pbg"), JSON.stringify({}), "utf-8", (err) => {
            if (err) {
                console.error("Failed to create graph file");
                console.error(err);
                return;
            }

            if (win) {
                win.loadFile('graph.html');
            }
        })
    });
}

ipcMain.on("createNewProject", function (event, arg) {
    createNewProject(arg);
});


ipcMain.on("showOpenProject", function (event, arg) {
    let path = dialog.showOpenDialog({
        properties: ["openDirectory"]
    })
    console.log(path);

    if (!path || path.length === 0) {
        return;
    }
    if (Array.isArray(path)) {
        path = path[0];
        if (!path || path.length === 0) {
            return;
        }
    }

    openProject(path);
})

function openProject(arg) {
    console.log("openProject", arg);
    if (!arg || arg.length === 0) return;
    let projectFilePath = path.join(arg, "project.pbp");
    if (!fs.existsSync(projectFilePath)) {
        console.error("No project file found");
        dialog.showErrorBox("Not found", "Could not find a PluginBlueprint project in that directory");
        return;
    }
    fs.readFile(projectFilePath, "utf-8", function (err, data) {
        if (err) {
            console.error("Failed to read project file");
            console.error(err);
            return;
        }

        currentProjectPath = arg;
        currentProject = JSON.parse(data);
        if (win) {
            win.loadFile('graph.html');
        }
    })
}

ipcMain.on("openProject", function (event, arg) {
    openProject(arg);
})

ipcMain.on("getProjectInfo", function (event, arg) {
    event.sender.send("projectInfo", currentProject || {});
});

ipcMain.on("getGraphData", function (event, arg) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    fs.readFile(path.join(currentProjectPath, "graph.pbg"), "utf-8", function (err, data) {
        if (err) {
            console.error("Failed to read graph file");
            console.error(err);
            return;
        }

        event.sender.send("graphData", JSON.parse(data));
    });
});

function saveGraphData(arg, cb) {
    if (!currentProject || !currentProjectPath) {
        return;
    }
    // backup
    let rs = fs.createReadStream(path.join(currentProjectPath, 'graph.pbg'));
    let ws = fs.createWriteStream(path.join(currentProjectPath, 'graph.pbg.old'));
    ws.on("close", function () {
        // write data
        fs.writeFile(path.join(currentProjectPath, "graph.pbg"), JSON.stringify(arg), "utf-8", function (err) {
            if (err) {
                console.error("Failed to save graph file");
                console.error(err);
                return;
            }

            if (cb) cb();
        })
    });
    rs.pipe(ws);
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
    });
});

function saveCodeToFile(code) {
    return new Promise((resolve, reject) => {
        if (!currentProject || !currentProjectPath) {
            return reject();
        }
        if (!code) return reject();

        fs.mkdirs(path.join(currentProjectPath, "src", "org", "inventivetalent", "pluginblueprint", "generated"), function (err) {
            if (err) {
                console.error("Failed to save code file");
                console.error(err);
                return;
            }
            fs.writeFile(path.join(currentProjectPath, "src", "org", "inventivetalent", "pluginblueprint", "generated", "GeneratedPlugin.java"), code, "utf-8", function (err) {
                if (err) {
                    console.error("Failed to save code file");
                    console.error(err);
                    return;
                }

                resolve();
            });
        });
    })

}

function makePluginYml() {
    return "name: " + currentProject.name +
        "\nversion: 0.0.0" +
        "\nmain: org.inventivetalent.pluginblueprint.generated.GeneratedPlugin" +//TODO: custom package
        "";
}

function compile() {
    return new Promise((resolve, reject) => {
        javaCompiler.compile(currentProjectPath).then((result) => {
            let pluginYml = makePluginYml();
            fs.writeFile(path.join(currentProjectPath, "classes", "plugin.yml"), pluginYml, function (err) {
                resolve();
            })
        });
    })
}

function pack() {
    return javaCompiler.package(currentProjectPath, currentProject);
}

ipcMain.on("codeGenerated", function (event, arg) {
    let actions = [];
    if (arg.code) {
        actions.push(saveCodeToFile(arg.code));
    }
    if (arg.compile) {
        actions.push(compile());
    }
    if (arg.pack) {
        actions.push(pack());
    }

    Promise.all(actions).then(() => {
        console.log("Done!");
        showNotification("Done!");
    })
});

ipcMain.on("openOutputDir", function (event, arg) {
    shell.openItem(path.join(currentProjectPath, "output"));
});

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
    })
    // }

    return {
        close: function () {
        }
    }
}
