let assert = require("assert");
const {defaultAuthor, defaultPackage} = require("../out/lib/projectDefaults");
const childProcess = require("child_process");
const os = require("os");

describe("ProjectDefaults", function () {
    it("should prefer git's author, then the OS user, then an empty author", async function () {
        let originalExecFile = childProcess.execFile, originalUserInfo = os.userInfo;
        try {
            childProcess.execFile = (command, args, callback) => {
                assert.strictEqual(command, "git");
                assert.deepStrictEqual(args, ["config", "user.name"]);
                callback(null, "  Test Author\n");
            };
            assert.strictEqual(await defaultAuthor(), "Test Author");
            childProcess.execFile = (command, args, callback) => callback(new Error("No git"), "");
            os.userInfo = () => ({username: "os-user"});
            assert.strictEqual(await defaultAuthor(), "os-user");
            os.userInfo = () => { throw new Error("No OS user"); };
            assert.strictEqual(await defaultAuthor(), "");
        } finally {
            childProcess.execFile = originalExecFile;
            os.userInfo = originalUserInfo;
        }
    });

    for (let [author, plugin, expected] of [
        ["Schäfer", "My Plugin", "me.schafer.myplugin"],
        ["Élodie Smith", "Café!", "me.elodiesmith.cafe"],
        ["3 Authors", "42Blocks", "me.x3authors.x42blocks"],
        ["@A.B-C_", "A + B", "me.abc.ab"],
        ["", "", "me.author.plugin"],
        ["!!!", "☃", "me.author.plugin"]
    ]) {
        it("should derive " + expected + " from " + JSON.stringify([author, plugin]), function () {
            assert.strictEqual(defaultPackage(author, plugin), expected);
        });
    }
});
