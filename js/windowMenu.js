const {Menu, getCurrentWindow} = require("@electron/remote");

function setWindowMenu(template) {
    if (process.platform !== "darwin") {
        const menu = Menu.buildFromTemplate(template);
        getCurrentWindow().setMenu(menu);
        return menu;
    }

    const items = [{role: "appMenu"}, ...template, {role: "windowMenu"}];
    if (!template.some(function (item) { return item.label === "Edit"; })) {
        items.splice(1, 0, {role: "editMenu"});
    }
    const menu = Menu.buildFromTemplate(items);
    function activateMenu() {
        Menu.setApplicationMenu(menu);
    }
    if (document.hasFocus()) {
        activateMenu();
    }
    window.addEventListener("focus", activateMenu);
    window.addEventListener("beforeunload", function () {
        if (Menu.getApplicationMenu() === menu) {
            Menu.setApplicationMenu(Menu.buildFromTemplate([
                {role: "appMenu"},
                {role: "fileMenu"},
                {role: "editMenu"},
                {role: "viewMenu"},
                {role: "windowMenu"}
            ]));
        }
    });
    return menu;
}

module.exports = setWindowMenu;
