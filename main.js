const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const {LiteGraph} = require("litegraph.js");
const NodeGenerator = require("./nodeGenerator");
const path = require("path");
const fs = require("fs");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

let currentProject;
let currentProjectPath;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
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
        win.webContents.openDevTools()
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

ipcMain.on("openGraph", function (event, arg) {
    if (win) {
        win.loadFile('graph.html');
    }
});

ipcMain.on("createNewProject", function (event, arg) {
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
});

ipcMain.on("openProject",function (event,arg) {
    if(!arg||arg.length===0)return;
    let projectFilePath = path.join(arg, "project.pbp");
    if (!fs.existsSync(projectFilePath)) {
            console.error("No project file found");
            dialog.showErrorBox("Not found", "Could not find a PluginBlueprint project in that directory");
            return;
    }
    fs.readFile(projectFilePath,"utf-8",function (err,data) {
        if (err) {
            console.error("Failed to read project file");
            console.error(err);
            return;
        }

        currentProjectPath = arg;
        currentProject=JSON.parse(data);
        if (win) {
            win.loadFile('graph.html');
        }
    })
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

ipcMain.on("saveGraphData",function (event,arg) {
    console.log("saveGraphData");
    if (!currentProject || !currentProjectPath) {
        return;
    }
    // backup
    let rs= fs.createReadStream(path.join(currentProjectPath,'graph.pbg'));
    let ws=fs.createWriteStream(path.join(currentProjectPath,'graph.pbg.old'));
    ws.on("close",function () {
        // write data
        fs.writeFile(path.join(currentProjectPath,"graph.pbg"),JSON.stringify(arg),"utf-8",function (err) {
            if (err) {
                console.error("Failed to save graph file");
                console.error(err);
                return;
            }

            event.sender.send("graphDataSaved");
        })
    });
    rs.pipe(ws);


});