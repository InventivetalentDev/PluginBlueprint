import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const directory = new URL('../../../data/classes/', import.meta.url);
const documents = ['paper', 'java'].map(name => {
    const text = readFileSync(new URL(`${name}.json`, directory), 'utf8');
    return { name, text, data: JSON.parse(text) };
});
const classes = new Map(documents.flatMap(({ data }) => data.classes.map(c => [c.qualifiedName, c])));
const method = (q, name, signature) => classes.get(q)?.methods.find(m => m.name === name && m.signature === signature);

for (const { name, text, data } of documents) {
    test(`${name}: metadata, size, and one class per line`, () => {
        assert.equal(data.size, data.classes.length);
        assert.ok(data.size > 0);
        const fields = name === 'paper'
            ? ['minecraftVersion', 'paperBuild', 'paperApiVersion', 'adventureVersion', 'javaVersion', 'generatedAt']
            : ['javaVersion', 'javaRuntimeVersion', 'generatedAt'];
        assert.deepEqual(Object.keys(data.meta).sort(), fields.sort());
        assert.equal(typeof data.meta.javaVersion, 'number');
        assert.ok(Number.isFinite(Date.parse(data.meta.generatedAt)));
        const lines = text.trimEnd().split('\n');
        assert.match(lines[0], /^\{"meta":.*,"size":\d+,"classes":\[$/);
        assert.equal(lines.at(-1), ']}');
        assert.deepEqual(lines.slice(1, -1).map(line => JSON.parse(line.replace(/,$/, ''))), data.classes);
        assert.deepEqual(data.classes.map(c => c.qualifiedName), data.classes.map(c => c.qualifiedName).sort());
    });
    test(`${name}: types and signatures have no annotations or unresolved types`, () => {
        function visit(value) {
            if (!value || typeof value !== 'object') return;
            for (const [key, child] of Object.entries(value)) {
                if (['signature', 'flatSignature', 'qualifiedName'].includes(key)) assert.doesNotMatch(child, /@|<any>/);
                visit(child);
            }
        }
        visit(data);
    });
}

test('saved node types from the legacy data resolve', () => {
    const expected = readFileSync(new URL('expected-node-types.txt', import.meta.url), 'utf8');
    for (const line of expected.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))) {
        const [q, member] = line.split('#');
        const type = classes.get(q);
        assert.ok(type, line);
        if (!member) continue;
        const open = member.indexOf('(');
        assert.ok([...type.methods, ...type.constructors].some(m => m.name === member.slice(0, open) && m.signature === member.slice(open)), line);
    }
});

test('real source supplies parameter names and comments', () => {
    const substring = method('java.lang.String', 'substring', '(int, int)');
    assert.deepEqual(substring.parameters.map(p => p.name), ['beginIndex', 'endIndex']);
    assert.ok(substring.comment.length > 0);
    const sendMessage = method('org.bukkit.command.CommandSender', 'sendMessage', '(java.lang.String)');
    assert.deepEqual(sendMessage.parameters.map(p => p.name), ['message']);
});

test('inheritance matches the legacy relationship arrays', () => {
    assert.equal(classes.get('org.bukkit.plugin.java.JavaPlugin').superclass, 'org.bukkit.plugin.PluginBase');
    assert.ok(classes.get('org.bukkit.plugin.Plugin').subInterfaces.includes('org.bukkit.plugin.PluginBase'));
});

test('Adventure sources include Component.text(String)', () => {
    assert.equal(method('net.kyori.adventure.text.Component', 'text', '(java.lang.String)').isStatic, true);
});
