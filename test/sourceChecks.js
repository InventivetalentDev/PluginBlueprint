const assert = require("assert");
const {isJavaIdentifier, isJavaTypeName, isNumberValue, isBooleanValue, numberTypes, propertyProblems, sourceProperty, sourceType, SourceError, NODE_KEYS, pickNodeKeys} = require("../out/lib/sourceChecks");

describe("SourceChecks", function () {
    it("accepts Unicode identifiers and rejects keywords and non-strings", function () {
        assert(isJavaIdentifier("$café_2"));
        for (const value of ["class", "true", "_", "a b", "3count", "", 5, null, {}]) assert(!isJavaIdentifier(value));
    });
    it("accepts Java type names and arrays without accepting source fragments", function () {
        for (const value of [...numberTypes, "boolean", "java.lang.String[]", "int[][]", "org.bukkit.entity.Player"]) assert(isJavaTypeName(value), value);
        for (const value of ["int x; static {}", "a b", "java.lang.String<T>", "java.class.Name", "int.Name", "void", "[]", "int[ ]", "int[]x", "a..b", "", null, {}]) assert(!isJavaTypeName(value), String(value));
    });
    it("accepts finite numbers and legacy text with the selected type's integral rule", function () {
        assert(isNumberValue("5", "int"));
        assert(isNumberValue("-1.5", "double"));
        assert(isNumberValue(1.5, "double"));
        for (const type of ["byte", "char", "short", "int", "long"]) {
            assert(!isNumberValue(1.5, type));
            assert(!isNumberValue("1.5", type));
        }
        for (const value of ["5;", NaN, Infinity, -Infinity, "Infinity", "1e2", " 5", "+5", "", true, null, {}]) assert(!isNumberValue(value, "double"));
    });
    it("accepts only boolean values and legacy boolean text", function () {
        for (const value of [true, false, "true", "false"]) assert(isBooleanValue(value));
        for (const value of ["TRUE", "false;", 0, 1, null, undefined, {}]) assert(!isBooleanValue(value));
    });
    const classes = {
        getClass: name => name === "Example" ? {enumConstants: ["VALUE"]} : undefined,
        getField: (name, field) => name === "Example" && field === "STATIC" ? {isStatic: true} : field === "instance" ? {isStatic: false} : undefined
    };
    for (const [type, property, valid, invalid] of [
        ["constants/NumberConstant", "type", "int", "int;"],
        ["constants/NumberConstant", "number", "5", "5;"],
        ["constants/BooleanConstant", "value", "false", "false;"],
        ["variables/Set", "name", "café", "class"],
        ["variables/Get", "type", "string", "int x;"],
        ["native/Cast", "castTo", "example.Unlisted[]", "a b"],
        ["native/InstanceOf", "type", "example.Unlisted", "a b"],
        ["arithmetic/Add", "type", "double", "boolean"],
        ["arrays/MakeArray", "type", "example.Unlisted", "java.lang.String<T>"],
        ["events/CancelEvent", "cancel", true, "true;"],
        ["Example", "priority", "HIGH", "HIGH;"],
        ["Example", "ignoreCancelled", false, "false"],
        ["Example", "en", "VALUE", "OTHER"],
        ["Example", "field", "STATIC", "instance"]
    ]) {
        it("uses the same rule for problems and source: " + type + "." + property, function () {
            const node = {id: 12, type, title: "Example node", className: "Example", properties: {type: "int", number: 0, name: "count", [property]: valid}};
            assert.deepStrictEqual(propertyProblems(node, classes), []);
            assert.strictEqual(sourceProperty(node, property, classes), String(valid));
            node.properties[property] = invalid;
            const problems = propertyProblems(node, classes);
            assert.strictEqual(problems.length, 1);
            assert.strictEqual(problems[0].property, property);
            assert.throws(() => sourceProperty(node, property, classes), error => error instanceof SourceError && error.nodeId === node.id && error.message === problems[0].message);
        });
    }
    it("requires class data for enum and static field selections", function () {
        for (const [property, value] of [["en", "VALUE"], ["field", "STATIC"]]) {
            const node = {id: 2, type: "Example", title: "Example", className: "Example", properties: {[property]: value}};
            assert.strictEqual(propertyProblems(node).length, 1);
            assert.throws(() => sourceProperty(node, property), SourceError);
        }
    });
    it("checks slot types and keeps the node id on an error", function () {
        const node = {id: 42, title: "Example", properties: {}};
        assert.strictEqual(sourceType(node, "java.lang.String[]"), "java.lang.String[]");
        assert.throws(() => sourceType(node, "int x;"), error => error instanceof SourceError && error.nodeId === 42);
    });
    it("copies only serialized node keys and keeps nested values by reference", function () {
        const properties = {number: 5};
        const node = {...Object.fromEntries(NODE_KEYS.map(key => [key, key])), properties, className: "Injected", classType: "event", nodeType: "BukkitClassNode"};
        const picked = pickNodeKeys(node);
        assert.notStrictEqual(picked, node);
        assert.deepStrictEqual(Object.keys(picked), NODE_KEYS);
        assert.strictEqual(picked.properties, properties);
        assert.strictEqual(picked.className, undefined);
        assert.strictEqual(picked.classType, undefined);
        assert.strictEqual(picked.nodeType, undefined);
        assert.strictEqual(node.className, "Injected");
    });
});
