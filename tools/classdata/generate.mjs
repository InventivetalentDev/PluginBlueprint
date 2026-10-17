import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const cache = path.join(here, '.cache');
const agent = 'PluginBlueprint-classdata (https://github.com/InventivetalentDev/PluginBlueprint)';
const api = 'https://fill.papermc.io/v3/projects/paper';

async function request(url) {
    const response = await fetch(url, { headers: { 'User-Agent': agent } });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response;
}

async function download(url, target, checksum) {
    if (checksum) {
        try {
            if (createHash('sha256').update(await readFile(target)).digest('hex') === checksum) return;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }
    const bytes = Buffer.from(await (await request(url)).arrayBuffer());
    if (checksum && createHash('sha256').update(bytes).digest('hex') !== checksum) {
        throw new Error(`SHA-256 mismatch: ${url}`);
    }
    await writeFile(target, bytes);
}

function run(command, args, cwd = here) {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error) throw result.error;
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error(`${path.basename(command)} exited ${result.status}`);
}

async function files(directory, suffix) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await files(target, suffix));
        else if (entry.name.endsWith(suffix)) result.push(target);
    }
    return result.sort();
}

// Javadoc argfiles use their own quoting rules, including on Windows.
const quote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

async function main() {
    let version;
    let out = path.join(root, 'data/classes');
    let resolveOnly = false;
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--resolve-only') resolveOnly = true;
        else if (['--version', '--out'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
            if (args[i] === '--version') version = args[++i];
            else out = path.resolve(args[++i]);
        } else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    const versions = version ? [version] : Object.values(await (await request(api)).json().then(p => p.versions)).flat();
    let build;
    for (const candidate of versions) {
        const latest = await (await request(`${api}/versions/${encodeURIComponent(candidate)}/builds/latest`)).json();
        if (latest.channel === 'STABLE') {
            version = candidate;
            build = latest;
            break;
        }
    }
    if (!build) throw new Error('No stable Paper build found');
    const details = await (await request(`${api}/versions/${encodeURIComponent(version)}`)).json();
    const javaVersion = details.version.java.version.minimum;
    if (resolveOnly) {
        console.log(JSON.stringify({ minecraftVersion: version, build: build.id, javaVersion }));
        return;
    }
    let javaHome = process.env.JAVA_HOME;
    const tool = name => javaHome ? path.join(javaHome, 'bin', name) : name;
    const settings = spawnSync(tool('java'), ['-XshowSettings:properties', '-version'], { encoding: 'utf8' });
    if (settings.error) throw settings.error;
    const properties = settings.stdout + settings.stderr;
    const found = properties.match(/java.version = (\d+)/)?.[1];
    if (Number(found) !== javaVersion) {
        throw new Error(`JDK ${javaVersion} required (found ${found ?? 'unknown'}). Set JAVA_HOME to a JDK ${javaVersion}.`);
    }
    javaHome = properties.match(/java.home = (.+)/)[1].trim();
    const runtime = properties.match(/java.runtime.version = (.+)/)[1].trim();
    await mkdir(cache, { recursive: true });
    await mkdir(out, { recursive: true });
    const serverJar = path.join(cache, `paper-${version}-${build.id}.jar`);
    const server = path.join(cache, `server-${version}-${build.id}`);
    const artifact = build.downloads['server:default'];
    await download(artifact.url, serverJar, artifact.checksums.sha256);
    await mkdir(server, { recursive: true });
    run(tool('java'), ['-Dpaperclip.patchonly=true', '-jar', serverJar], server);
    const libraries = path.join(server, 'libraries');
    const jars = await files(libraries, '.jar');
    const paperJar = jars.find(file => /[/\\]paper-api[/\\]/.test(file));
    if (!paperJar) throw new Error('Paper API jar missing from unpacked server');
    const apiVersion = path.basename(path.dirname(paperJar));
    const available = new Set(jars.map(file => {
        const parts = path.relative(libraries, path.dirname(path.dirname(file))).split(path.sep);
        return `${parts.slice(0, -1).join('.')}:${parts.at(-1)}`;
    }));
    async function compileDependencies(base) {
        const metadata = path.join(cache, `${base.split('/').at(-1)}.module`);
        await download(`${base}.module`, metadata);
        const module = JSON.parse(await readFile(metadata, 'utf8'));
        const dependencies = module.variants.filter(v => v.attributes['org.gradle.usage'] === 'java-api').flatMap(v => v.dependencies ?? []);
        for (const dependency of dependencies) {
            const { group, module: artifact, version: required, attributes } = dependency;
            const coordinate = `${group}:${artifact}`;
            if (attributes?.['org.gradle.category'] === 'platform' || available.has(coordinate)) continue;
            const v = required?.requires;
            if (!v) throw new Error(`Missing compile dependency version: ${coordinate}`);
            const jar = path.join(cache, `${group}-${artifact}-${v}.jar`);
            try {
                await access(jar);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                await download(`https://repo1.maven.org/maven2/${group.replaceAll('.', '/')}/${artifact}/${v}/${artifact}-${v}.jar`, jar);
            }
            jars.push(jar);
            available.add(coordinate);
        }
    }
    await compileDependencies(`https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/${apiVersion}/paper-api-${apiVersion}`);
    const sourceRoots = [];
    const paperSources = path.join(cache, `paper-api-${apiVersion}-sources.jar`);
    await download(`https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/${apiVersion}/paper-api-${apiVersion}-sources.jar`, paperSources);
    const paperRoot = path.join(cache, `paper-sources-${apiVersion}`);
    await mkdir(paperRoot, { recursive: true });
    run(tool('jar'), ['xf', paperSources], paperRoot);
    sourceRoots.push(paperRoot);
    let adventureVersion;
    for (const name of ['adventure-api', 'adventure-key', 'adventure-text-minimessage']) {
        const jar = jars.find(file => path.basename(file).startsWith(`${name}-`) && path.basename(path.dirname(path.dirname(file))) === name);
        if (!jar) throw new Error(`${name} jar missing from unpacked server`);
        const v = path.basename(path.dirname(jar));
        if (name === 'adventure-api') adventureVersion = v;
        await compileDependencies(`https://repo1.maven.org/maven2/net/kyori/${name}/${v}/${name}-${v}`);
        const source = path.join(cache, `${name}-${v}-sources.jar`);
        await download(`https://repo1.maven.org/maven2/net/kyori/${name}/${v}/${name}-${v}-sources.jar`, source);
        const sourceRoot = path.join(cache, `${name}-sources-${v}`);
        await mkdir(sourceRoot, { recursive: true });
        run(tool('jar'), ['xf', source], sourceRoot);
        sourceRoots.push(sourceRoot);
    }
    const classes = path.join(cache, 'doclet');
    await mkdir(classes, { recursive: true });
    run(tool('javac'), ['-d', classes, path.join(here, 'JsonDoclet.java')]);
    const generatedAt = new Date().toISOString();
    async function document(name, meta, options, sources) {
        const argfile = path.join(cache, `${name}.args`);
        const argumentsList = ['-quiet', '-protected', '-encoding', 'UTF-8', '-doclet', 'JsonDoclet', '-docletpath', classes,
            '-outfile', path.join(out, `${name}.json`), '-meta', JSON.stringify(meta), ...options, ...sources];
        await writeFile(argfile, argumentsList.map(quote).join('\n'));
        run(tool('javadoc'), [`@${argfile}`]);
    }
    const sources = (await Promise.all(sourceRoots.map(dir => files(dir, '.java')))).flat().filter(file => !file.endsWith('module-info.java'));
    await document('paper', { minecraftVersion: version, paperBuild: build.id, paperApiVersion: apiVersion, adventureVersion, javaVersion, generatedAt },
        ['-classpath', jars.join(path.delimiter), '-sourcepath', classes], sources);
    const jdkSources = path.join(cache, `jdk-sources-${javaVersion}`);
    await mkdir(jdkSources, { recursive: true });
    run(tool('jar'), ['xf', path.join(javaHome, 'lib/src.zip'), 'java.base/'], jdkSources);
    await document('java', { javaVersion, javaRuntimeVersion: runtime, generatedAt },
        ['--module-source-path', jdkSources, '--module', 'java.base'], []);
    for (const name of ['paper', 'java']) {
        const data = await readFile(path.join(out, `${name}.json`));
        console.error(`${name}.json: ${JSON.parse(data).size} classes, ${data.length} bytes`);
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
