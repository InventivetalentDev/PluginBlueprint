let assert = require("assert");
const {makePluginYml} = require("../out/lib/pluginYml");

let project = {
    name: "Test", description: 'A "plugin"', version: "1.0", package: "me.test.plugin",
    author: "Tester", minecraftVersion: "26.3", softdepend: ["Vault"],
    commands: [{name: "hello", description: "Say hello", usage: "/hello", aliases: " hi, hey, "}]
};
let legacy = 'name: "Test"\ndescription: "A \\"plugin\\""\nversion: "1.0"\nmain: "me.test.plugin.GeneratedPlugin"\nauthor: "Tester"\nsoftdepend: ["Vault"]\ngenerator: "PluginBlueprint 2.0.0"\napi-version: \'26.3\'\ncommands:\n  "hello":\n    description: "Say hello"\n    usage: "/hello"\n    aliases: ["hi","hey"]\n';

describe("PluginYml", function () {
    it("should preserve the legacy output byte for byte", function () {
        assert.strictEqual(makePluginYml(project, "2.0.0"), legacy);
        let withoutOptionalFields = {...project};
        delete withoutOptionalFields.softdepend;
        delete withoutOptionalFields.commands;
        assert.strictEqual(makePluginYml(withoutOptionalFields, "2.0.0"), legacy.replace('["Vault"]', '[]').split("commands:\n")[0]);
    });

    it("should emit the new fields in order with quoted values and nested permissions", function () {
        let yml = makePluginYml({...project, depend: ["Required"], loadbefore: ["Later"], load: "STARTUP",
            website: "https://example.com", authors: ["One", "Two"], prefix: "Test: plugin", libraries: ["org.example:lib:1.0"],
            permissions: [{name: "test.use", description: 'Use "test"', default: "not op"}, {name: "test.empty"}]
        }, "2.0.0");
        let fields = '\ndepend: ["Required"]\nloadbefore: ["Later"]\nload: "STARTUP"\nwebsite: "https://example.com"\nauthors: ["One","Two"]\nprefix: "Test: plugin"\nlibraries: ["org.example:lib:1.0"]\npermissions:\n  "test.use":\n    description: "Use \\"test\\""\n    default: "not op"\n  "test.empty": {}';
        assert.strictEqual(yml, legacy.replace('\ngenerator:', fields + '\ngenerator:'));
        assert.ok(makePluginYml({...project, load: "POSTWORLD"}, "2.0.0").includes('load: "POSTWORLD"\n'));
        for (let value of ["true", "false", "op"]) {
            assert.ok(makePluginYml({...project, permissions: [{name: "test.use", default: value}]}, "2.0.0").includes('    default: "' + value + '"\n'));
        }
    });

    it("should omit empty optional fields", function () {
        assert.strictEqual(makePluginYml({...project, depend: [], loadbefore: [], website: "", authors: [], prefix: "", libraries: [], permissions: []}, "2.0.0"), legacy);
    });
});
