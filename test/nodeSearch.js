const assert = require("assert");
const {performance} = require("perf_hooks");
const ClassDataStore = require("../out/lib/classDataStore");
const {aliases, buildSearchEntries, firstSentence, searchNodes} = require("../out/lib/nodeSearch");

describe("Node search", function () {
    const store = new ClassDataStore();
    let entries;
    let types;
    const lookup = {
        getClass: name => store.getClass(name),
        getMethod: (owner, signature) => store.getMethod(owner, signature),
        getConstructor: (owner, signature) => store.getConstructor(owner, signature),
        getTitle: type => type === "native/ConsoleLog" ? "ConsoleLog" : undefined
    };

    before(async function () {
        this.timeout(30000);
        await store.init();
        types = ["native/ConsoleLog"];
        for (const clazz of Object.values(store.getClassesByName())) {
            types.push(clazz.qualifiedName);
            for (const method of Object.values(clazz.methodsBySignature)) {
                types.push(clazz.qualifiedName + "#" + method.fullSignature);
                types.push(clazz.qualifiedName + "{" + method.fullSignature + "}");
            }
            for (const constructor of Object.values(clazz.constructorsBySignature)) {
                types.push(clazz.qualifiedName + "#" + constructor.fullSignature);
            }
            for (const field of Object.values(clazz.fieldsByName)) {
                if (field.isStatic && !field.isDeprecated) types.push(clazz.qualifiedName + "#static:" + field.type.qualifiedName);
            }
        }
        entries = buildSearchEntries([...new Set(types)], lookup);
    });

    for (const query of ["PlayerJoinEvent", "playerjoinevent", "welcome"]) {
        it(`ranks PlayerJoinEvent first for ${query}`, function () {
            assert.equal(searchNodes(entries, query)[0].type, "org.bukkit.event.player.PlayerJoinEvent");
        });
    }

    it("ranks ItemStack first and includes PlayerJoinEvent in the first five join results", function () {
        assert.equal(searchNodes(entries, "ItemStack")[0].type, "org.bukkit.inventory.ItemStack");
        assert(searchNodes(entries, "join", 5).some(entry => entry.type === "org.bukkit.event.player.PlayerJoinEvent"));
        assert.equal(searchNodes(entries, "org.bukkit.inventory.ItemStack")[0].type, "org.bukkit.inventory.ItemStack");
    });

    it("excludes override nodes, deprecated classes and deprecated members", function () {
        assert(types.includes("org.bukkit.entity.Player#getDisplayName()"));
        assert(!entries.some(entry => entry.type === "org.bukkit.entity.Player#getDisplayName()"));
        for (const entry of entries) {
            assert(!entry.type.includes("{"), entry.type);
            if (entry.kind === "native") continue;
            const [owner, signature] = entry.type.split("#");
            assert(!store.getClass(owner).isDeprecated, entry.type);
            if (signature && !signature.startsWith("static:")) {
                const member = store.getMethod(owner, signature) || store.getConstructor(owner, signature);
                assert(member && !member.isDeprecated, entry.type);
            }
        }
    });

    it("resolves every alias to a searchable class, method or constructor", function () {
        for (const [keyword, targets] of Object.entries(aliases)) {
            for (const target of targets) {
                const [owner, signature] = target.split("#");
                assert(signature ? store.getMethod(owner, signature) || store.getConstructor(owner, signature) : store.getClass(owner), target);
                assert(entries.some(entry => entry.type === target), target);
                assert(searchNodes(entries, keyword).some(entry => entry.type === target), keyword + ": " + target);
            }
        }
    });

    it("requires every query word and limits results to 50", function () {
        const results = searchNodes(entries, "player join");
        assert(results.some(entry => entry.type === "org.bukkit.event.player.PlayerJoinEvent"));
        for (const entry of results) {
            const text = [entry.name, entry.type, entry.description].join(" ").toLowerCase();
            assert(text.includes("player") && text.includes("join"));
        }
        assert(searchNodes(entries, "").length <= 50);
        assert.doesNotThrow(() => searchNodes(entries, "constructor"));
    });

    it("uses name tiers before description matches and resolves ties consistently", function () {
        const names = ["java.sample.Join", "org.bukkit.Join", "org.bukkit.JoinEvent", "org.bukkit.PlayerJoinEvent", "org.bukkit.Adjoined", "org.bukkit.Other"];
        const kinds = [false, false, true, true, false, false];
        const sample = buildSearchEntries(names, {
            ...lookup,
            getClass: name => ({simpleName: name.split(".").pop(), package: name.slice(0, name.lastIndexOf(".")), isEvent: kinds[names.indexOf(name)], comment: "Join players together."})
        });
        assert.deepEqual(searchNodes(sample, "join").map(entry => entry.name), ["Join", "Join", "JoinEvent", "PlayerJoinEvent", "Adjoined", "Other"]);
        assert.equal(searchNodes(sample, "join")[0].type, "org.bukkit.Join");
        assert(!searchNodes(sample, "jo").some(entry => entry.name === "Other"));
    });

    it("cleans comments without cutting abbreviations or qualified references", function () {
        assert.equal(firstSentence("Use e.g. a player. Next sentence."), "Use e.g. a player.");
        assert.equal(firstSentence("Gets {@link org.bukkit.entity.Player}. More details."), "Gets Player.");
        assert.equal(firstSentence("Uses {@link org.bukkit.entity.Player#getName()} and {@code java.lang.String}."), "Uses Player.getName() and String.");
        assert.equal(firstSentence("<p>Use {@link Player}.</p>"), "Use Player.");
        assert.equal(firstSentence("a".repeat(140)).length, 120);
        assert.equal(firstSentence(), "");
    });

    it("searches the full index in under 100 ms", function () {
        assert(entries.length > 25000, String(entries.length));
        const started = performance.now();
        searchNodes(entries, "player");
        const elapsed = performance.now() - started;
        assert(elapsed < 100, `Search took ${elapsed.toFixed(1)} ms for ${entries.length} entries`);
    });
});
