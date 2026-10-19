const assert = require("assert");
const {performance} = require("perf_hooks");
const H = require("./support/harness");
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
        getTitle: type => H.LiteGraph().registered_node_types[type]?.title
    };

    before(async function () {
        this.timeout(30000);
        await H.setup();
        await store.init();
        types = Object.keys(H.LiteGraph().registered_node_types);
        entries = buildSearchEntries(types, lookup);
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

    it("resolves every alias to a searchable native node, class, method or constructor", function () {
        for (const [keyword, targets] of Object.entries(aliases)) {
            for (const target of targets) {
                if (target.includes("/")) {
                    assert(H.LiteGraph().registered_node_types[target], target);
                } else {
                    const [owner, signature] = target.split("#");
                    assert(signature ? store.getMethod(owner, signature) || store.getConstructor(owner, signature) : store.getClass(owner), target);
                }
                assert(entries.some(entry => entry.type === target), target);
                assert(searchNodes(entries, keyword).some(entry => entry.type === target), keyword + ": " + target);
            }
        }
    });

    it("labels constants while keeping exact Sound class matches first", function () {
        const results = searchNodes(entries, "Sound");
        assert.equal(results[0].kind, "class");
        assert(results.findIndex(entry => entry.type === "org.bukkit.Sound") <
            results.findIndex(entry => entry.type === "org.bukkit.Sound#static:org.bukkit.Sound"));
        const constant = results.find(entry => entry.type === "org.bukkit.Sound#static:org.bukkit.Sound");
        assert.equal(constant.name, "Sound (constant)");
        assert.equal(constant.lowerName, "sound");
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
