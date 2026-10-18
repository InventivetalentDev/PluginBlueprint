let assert = require("assert");
let fs = require("fs-extra");
let os = require("os");
let path = require("path");
const {listJavaSources} = require("../out/lib/javaCompiler");

describe("JavaCompiler", function () {
    let srcDir;
    beforeEach(async function () {
        srcDir = await fs.mkdtemp(path.join(os.tmpdir(), "pluginblueprint-java-"));
    });
    afterEach(async function () {
        await fs.remove(srcDir);
    });

    it("should list all Java sources in sorted order across nested packages", async function () {
        let files = ["z/Helper.java", "me/test/GeneratedPlugin.java", "Root.java", "a space/Extra.java"];
        for (let file of [...files, "readme.txt", "me/test/ignore.class", "manifest"]) {
            await fs.outputFile(path.join(srcDir, file), "test");
        }
        await fs.ensureDir(path.join(srcDir, "folder.java"));
        assert.deepStrictEqual(await listJavaSources(srcDir), files.map(file => path.join(srcDir, file)).sort());
    });

    it("should return an empty list for an empty source directory", async function () {
        assert.deepStrictEqual(await listJavaSources(srcDir), []);
    });
});
