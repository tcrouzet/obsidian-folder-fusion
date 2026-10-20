import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const module = { exports: {} };
runInNewContext(transformSync(readFileSync(new URL('../plugin/main.ts', import.meta.url), 'utf8'), {
	loader: 'ts', format: 'cjs'
}).code, {
	module,
	exports: module.exports,
	require: name => {
		assert.equal(name, 'obsidian');
		return { Plugin: class {}, PluginSettingTab: class {} };
	}
});

async function pluginWithFiles(contents = {}) {
	const plugin = new module.exports.default();
	plugin.loadData = async () => null;
	await plugin.loadSettings();
	plugin.app = { vault: {
		getFiles: () => Object.keys(contents).map(path => ({ path })),
		read: async file => contents[file.path]
	} };
	return plugin;
}

test('compiles nested files in path order, excluding snapshots and configured paths', async () => {
	const plugin = await pluginWithFiles({
		'Book/02-Part/01-Chapter.md': 'Second',
		'Book/01-Chapter.md': 'First',
		'Book/fusion-Book-20251001-1200.md': 'Old snapshot',
		'Book/_index.md': 'Index',
		'Other/Chapter.md': 'Other'
	});
	plugin.settings.noteSeparator = '***\n';
	assert.equal(await plugin.concatenateFiles('Book'), 'First\n\n***\nSecond\n\n***\n');
	assert.equal(await plugin.concatenateFiles('Empty'), '');
});

test('removes comments and strikethrough by default, preserving them when disabled', async () => {
	const plugin = await pluginWithFiles({ 'Book/Chapter.md': 'A<!-- hidden -->B%% draft %%C~~cut~~D' });
	assert.equal(await plugin.concatenateFiles('Book'), 'ABCD\n\n');
	plugin.settings.nocomments = false;
	plugin.settings.noMDcomments = false;
	assert.equal(await plugin.concatenateFiles('Book'), 'A<!-- hidden -->B%% draft %%C~~cut~~D\n\n');
});

test('applies optional manuscript styles only when enabled', async () => {
	const source = '--Title--\n@@Right\n££Opening\n\\newpage';
	const plugin = await pluginWithFiles({ 'Book/Chapter.md': source });
	assert.equal(await plugin.concatenateFiles('Book'), source + '\n\n');
	Object.assign(plugin.settings, { smallcaps: true, right: true, toppara: true, newpage: true });
	assert.equal(await plugin.concatenateFiles('Book'),
		'<span style="font-variant:small-caps">Title</span>\n' +
		'<div custom-style="Right" class="right" align="right">Right</div>\n' +
		'<div custom-style="top-para" class="top-para" style="text-align:justify">Opening</div>\n' +
		'<div custom-style="page-break" class="page-beak" style="page-break-after: always">-</div>\n\n');
});

test('formats a poem with one stanza or several stanzas', async () => {
	const plugin = await pluginWithFiles({ 'Book/Poem.md': '€€One€€' });
	assert.equal(await plugin.concatenateFiles('Book'), '€€One€€\n\n');
	plugin.settings.poem = true;
	assert.equal(await plugin.concatenateFiles('Book'), '<div custom-style="poem-solo" class="poem-solo">One</div>\n\n\n');
	assert.equal(plugin.poem('€€First\n\nMiddle\n\nLast€€'),
		'<div custom-style="poem-top" class="poem-top">First</div>\n\n' +
		'<div custom-style="poem" class="poem">Middle</div>\n\n' +
		'<div custom-style="poem-bottom" class="poem-bottom">Last</div>');
});

test('renumbers numeric footnotes across chapters and gathers definitions at the end', async () => {
	const plugin = await pluginWithFiles({
		'Book/01.md': 'First[^1].\n\n[^1]: First note',
		'Book/02.md': 'Second[^1].\n\n[^1]: Second note'
	});
	assert.equal(await plugin.concatenateFiles('Book'),
		'First[^1].\n\n\n\nSecond[^2].\n\n[^1]: First note\n\n[^2]: Second note');
});

test('writes a snapshot inside the selected folder using its name and a UTC timestamp', async () => {
	const plugin = await pluginWithFiles();
	const writes = [];
	plugin.app.vault.adapter = { write: async (...args) => writes.push(args) };
	await plugin.savingFiles('Draft/Book', 'Manuscript');
	assert.equal(writes.length, 1);
	assert.match(writes[0][0], /^Draft\/Book\/fusion-Book-\d{8}-\d{4}\.md$/);
	assert.equal(writes[0][1], 'Manuscript');
});

test('release preflight accepts a matching tag and rejects mismatches or missing artifacts', t => {
	const directory = mkdtempSync(join(tmpdir(), 'folder-fusion-release-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ version: '1.2.3' }));
	for (const file of ['main.js', 'styles.css']) {
		writeFileSync(join(directory, file), 'fixture');
	}
	const check = tag => spawnSync(process.execPath, [fileURLToPath(new URL('./check-release.mjs', import.meta.url))], {
		cwd: directory,
		env: { ...process.env, GITHUB_REF_NAME: tag },
		encoding: 'utf8'
	});
	const valid = check('1.2.3');
	assert.equal(valid.status, 0, valid.stderr);
	assert.equal(valid.stdout.trim(), '1.2.3');
	for (const tag of ['1.2.4', 'v1.2.3', 'invalid']) {
		const invalid = check(tag);
		assert.notEqual(invalid.status, 0);
		assert.match(invalid.stderr, /Release tag must match manifest version/);
	}
	rmSync(join(directory, 'main.js'));
	const missing = check('1.2.3');
	assert.notEqual(missing.status, 0);
	assert.match(missing.stderr, /ENOENT.*main\.js/);
});

function releaseFixture(t) {
	const directory = mkdtempSync(join(tmpdir(), 'folder fusion release '));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(join(directory, 'scripts'));
	mkdirSync(join(directory, 'bin'));
	for (const file of ['release.sh', 'scripts/publish-release.sh', 'scripts/check-release.mjs', 'scripts/version-bump.mjs']) {
		copyFileSync(new URL('../' + file, import.meta.url), join(directory, file));
	}
	writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ version: '1.0.3', minAppVersion: '1.5.0', description: 'Keep this description' }));
	writeFileSync(join(directory, 'versions.json'), JSON.stringify({ '1.0.0': '0.15.0' }));
	writeFileSync(join(directory, 'commit.json'), JSON.stringify({ repo: 'example/folder-fusion' }));
	writeFileSync(join(directory, 'package.json'), JSON.stringify({
		name: 'release-fixture', version: '1.0.0', scripts: {
			test: 'node -e "process.exit(0)"',
			typecheck: 'node -e "process.exit(0)"',
			lint: 'node -e "process.exit(0)"',
			build: 'node -e "process.exit(Number(process.env.FAIL_BUILD || 0))"',
			version: 'node scripts/version-bump.mjs && git add manifest.json versions.json'
		}
	}));
	writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({
		name: 'release-fixture', version: '1.0.0', lockfileVersion: 3,
		packages: { '': { name: 'release-fixture', version: '1.0.0' } }
	}));
	for (const file of ['main.js', 'styles.css']) writeFileSync(join(directory, file), 'fixture');
	const tool = join(directory, 'bin', 'tool');
	writeFileSync(tool, `#!${process.execPath}
const fs = require('node:fs');
const name = require('node:path').basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync('commands.jsonl', JSON.stringify([name, ...args]) + '\\n');
if (name === 'git' && args[0] === 'branch') console.log('main');
if (name === 'gh' && args[0] === 'repo') console.log(JSON.stringify({ nameWithOwner: 'example/folder-fusion', defaultBranchRef: { name: 'main' } }));
if (name === 'gh' && args[0] === 'api') {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  if (process.env.MISMATCH_MANIFEST) manifest.description = 'Different remote manifest';
  console.log(JSON.stringify(manifest));
}
if (name === 'git' && args[0] === 'diff') process.exit(1);
if (name === 'gh' && args[0] === 'release' && args[2] === '1.0.3') {
  console.error('a release with the same tag name already exists: 1.0.3');
  process.exit(1);
}
if (name === 'git' && args[0] === 'push' && process.env.FAIL_PUSH) process.exit(1);
`, { mode: 0o755 });
	for (const name of ['git', 'gh']) symlinkSync(tool, join(directory, 'bin', name));
	return {
		directory,
		json: file => JSON.parse(readFileSync(join(directory, file), 'utf8')),
		commands: () => readFileSync(join(directory, 'commands.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)),
		run: (extra = {}) => {
			const env = { ...process.env, PATH: join(directory, 'bin') + ':' + process.env.PATH, ...extra };
			delete env.GITHUB_REF_NAME;
			delete env.GITHUB_REF_TYPE;
			return spawnSync('bash', [join(directory, 'release.sh')], { cwd: tmpdir(), env, encoding: 'utf8' });
		}
	};
}

test('release.sh increments 1.0.3 to 1.0.4 then 1.0.5 and pushes each matching tag', t => {
	const fixture = releaseFixture(t);
	for (const version of ['1.0.4', '1.0.5']) {
		const result = fixture.run();
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.equal(fixture.json('manifest.json').version, version);
		assert.equal(fixture.json('manifest.json').description, 'Keep this description');
		assert.equal(fixture.json('package.json').version, version);
		assert.equal(fixture.json('package-lock.json').version, version);
		assert.equal(fixture.json('package-lock.json').packages[''].version, version);
		assert.equal(fixture.json('versions.json')[version], '1.5.0');
		assert.ok(fixture.commands().some(args => JSON.stringify(args) === JSON.stringify(['git', 'push', 'origin', version])));
	}
});

test('release.sh stops before changing versions or committing when the build fails', t => {
	const fixture = releaseFixture(t);
	const result = fixture.run({ FAIL_BUILD: '1' });
	assert.notEqual(result.status, 0);
	assert.equal(fixture.json('manifest.json').version, '1.0.3');
	assert.ok(!fixture.commands().some(args => ['commit', 'push', 'tag'].includes(args[1])));
});

test('release.sh stops before tagging when the branch push fails', t => {
	const fixture = releaseFixture(t);
	const result = fixture.run({ FAIL_PUSH: '1' });
	assert.notEqual(result.status, 0);
	assert.ok(fixture.commands().some(args => args[0] === 'git' && args[1] === 'push'));
	assert.ok(!fixture.commands().some(args => args[0] === 'git' && args[1] === 'tag'));
});

test('release.sh refuses to tag when the published manifest differs from the local manifest', t => {
	const fixture = releaseFixture(t);
	const result = fixture.run({ MISMATCH_MANIFEST: '1' });
	assert.notEqual(result.status, 0);
	assert.match(result.stdout + result.stderr, /le manifest GitHub diffère/);
	assert.ok(!fixture.commands().some(args => args[0] === 'git' && args[1] === 'tag'));
});

test('CI publishes the existing version tag without incrementing it and rejects a mismatch', t => {
	const fixture = releaseFixture(t);
	const manifest = { ...fixture.json('manifest.json'), version: '1.0.4' };
	writeFileSync(join(fixture.directory, 'manifest.json'), JSON.stringify(manifest));
	const publish = tag => spawnSync('bash', [join(fixture.directory, 'scripts/publish-release.sh')], {
		cwd: tmpdir(),
		env: { ...process.env, PATH: join(fixture.directory, 'bin') + ':' + process.env.PATH, GITHUB_REF_NAME: tag },
		encoding: 'utf8'
	});
	const valid = publish('1.0.4');
	assert.equal(valid.status, 0, valid.stdout + valid.stderr);
	assert.deepEqual(fixture.commands(), [[
		'gh', 'release', 'create', '1.0.4', 'main.js', 'manifest.json', 'styles.css',
		'--repo', 'example/folder-fusion', '--verify-tag', '--title', '1.0.4', '--generate-notes'
	]]);
	assert.deepEqual(fixture.json('manifest.json'), manifest);
	const invalid = publish('1.0.5');
	assert.notEqual(invalid.status, 0);
	assert.match(invalid.stderr, /Release tag must match manifest version/);
	assert.equal(fixture.commands().length, 1);
});
