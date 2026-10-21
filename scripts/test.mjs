import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import yaml from 'js-yaml';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { Linter } = require('eslint');
const sourcePath = fileURLToPath(new URL('../plugin/main.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');

test('source typechecks with the declared browser libraries without ambient Node types', () => {
	const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(new URL('..', import.meta.url)));
	const program = ts.createProgram(parsed.fileNames, { ...parsed.options, types: [], noEmit: true, skipLibCheck: true });
	assert.deepEqual(ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), []);
});

test('source handles promises and avoids unsafe values under type-aware lint rules', () => {
	const linter = new Linter();
	linter.defineParser('@typescript-eslint/parser', require('@typescript-eslint/parser'));
	const rules = require('@typescript-eslint/eslint-plugin').rules;
	const names = ['no-floating-promises', 'no-misused-promises', 'no-unsafe-assignment', 'no-unsafe-call', 'no-unsafe-member-access', 'no-unsafe-return'];
	for (const name of names) linter.defineRule('@typescript-eslint/' + name, rules[name]);
	assert.deepEqual(linter.verify(source, {
		parser: '@typescript-eslint/parser',
		parserOptions: { sourceType: 'module', project: './tsconfig.json', tsconfigRootDir: fileURLToPath(new URL('..', import.meta.url)) },
		rules: Object.fromEntries(names.map(name => ['@typescript-eslint/' + name, 'error']))
	}, sourcePath), []);
});

const workflow = yaml.load(readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'));
const releaseSteps = workflow.jobs.build.steps;

function runWorkflowStep(name, fixture, tag) {
	return spawnSync('bash', ['-c', releaseSteps.find(step => step.name === name).run], {
		cwd: fixture.directory,
		env: { ...process.env, PATH: join(fixture.directory, 'bin') + ':' + process.env.PATH, RELEASE_TAG: tag },
		encoding: 'utf8'
	});
}

const module = { exports: {} };
const notices = [];
const settingObservers = [];
class Setting {
	constructor(container) { this.row = {}; container.rows.push(this.row); }
	setName(name) { this.row.name = name; return this; }
	setDesc(desc) { this.row.desc = desc; return this; }
	setHeading() { this.row.heading = true; return this; }
	addControl(type, callback) {
		const row = this.row;
		row.type = type;
		callback({
			inputEl: row.inputEl = {},
			setValue(value) { row.value = value; return this; },
			setPlaceholder(value) { row.placeholder = value; return this; },
			onChange(change) { row.change = change; return this; }
		});
		return this;
	}
	addToggle(callback) { return this.addControl('toggle', callback); }
	addText(callback) { return this.addControl('text', callback); }
}
class TFile {
	constructor(path) { this.path = path; }
	get name() { return this.path.split('/').pop(); }
	get extension() { return this.name.includes('.') ? this.name.slice(this.name.lastIndexOf('.') + 1) : ''; }
	get basename() { return this.extension ? this.name.slice(0, -this.extension.length - 1) : this.name; }
}
class TFolder {
	constructor(path) { this.path = path; this.children = []; }
	get name() { return this.path.split('/').pop(); }
}
runInNewContext(transformSync(source + '\nexport { FolderFusionSettingTab };', {
	loader: 'ts', format: 'cjs'
}).code, {
	module,
	exports: module.exports,
	crypto: globalThis.crypto,
	MutationObserver: class {
		constructor(callback) { this.callback = callback; settingObservers.push(this); }
		observe(target, options) { this.target = target; this.options = options; }
		disconnect() { this.disconnected = true; }
	},
	createFragment: callback => {
		const fragment = { children: [], appendText(text) { this.children.push(text); }, createEl(tag, attributes) { this.children.push({ tag, ...attributes }); } };
		callback(fragment);
		return fragment;
	},
	require: name => {
		assert.equal(name, 'obsidian');
		return { Plugin: class { register() {} }, PluginSettingTab: class { constructor() { this.containerEl = {}; } }, TFile, TFolder, Setting, Notice: class { constructor(message) { notices.push(message); } } };
	}
});

async function pluginWithFiles(contents = {}) {
	const plugin = new module.exports.default();
	plugin.loadData = async () => null;
	await plugin.loadSettings();
	const entries = new Map();
	const fileContents = new Map();
	function folderAt(path) {
		if (!entries.has(path)) {
			const folder = new TFolder(path);
			entries.set(path, folder);
			if (path) {
				folder.parent = folderAt(path.split('/').slice(0, -1).join('/'));
				folder.parent.children.push(folder);
			}
		}
		return entries.get(path);
	}
	folderAt('');
	for (const path of Object.keys(contents)) {
		const file = new TFile(path);
		entries.set(path, file);
		fileContents.set(file, contents[path]);
		file.parent = folderAt(path.split('/').slice(0, -1).join('/'));
		file.parent.children.push(file);
	}
	plugin.app = { vault: {
		getAbstractFileByPath: path => entries.get(path) ?? null,
		read: async file => fileContents.get(file)
	}, fileManager: {
		renameFile: async (file, path) => {
			assert.equal(path.split('/').slice(0, -1).join('/'), file.parent.path);
			assert.ok(!entries.has(path) || entries.get(path) === file, 'Rename must never overwrite another item');
			const original = file.path;
			const moved = [file];
			for (const entry of moved) if (entry instanceof TFolder) moved.push(...entry.children);
			for (const entry of moved) entries.delete(entry.path);
			for (const entry of moved) {
				entry.path = path + entry.path.slice(original.length);
				entries.set(entry.path, entry);
			}
		}
	} };
	return plugin;
}

test('export waits for snapshot writing and propagates read and write failures', async () => {
	const plugin = await pluginWithFiles({ 'Book/Chapter.md': 'Text' });
	let finishWrite;
	plugin.app.vault.adapter = { write: () => new Promise(resolve => { finishWrite = resolve; }) };
	let finished = false;
	const exported = plugin.exportFolder('Book').then(() => { finished = true; });
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(finished, false);
	finishWrite();
	await exported;
	const writeError = new Error('Cannot write snapshot');
	plugin.app.vault.adapter.write = () => Promise.reject(writeError);
	await assert.rejects(() => plugin.exportFolder('Book'), error => error === writeError);
	plugin.app.vault.adapter.write = () => { throw new Error('Unexpected write'); };
	const readError = new Error('Cannot read chapter');
	plugin.app.vault.read = () => Promise.reject(readError);
	await assert.rejects(() => plugin.exportFolder('Book'), error => error === readError);
});

test('folder menu reports export failures to the user', async () => {
	const plugin = await pluginWithFiles({ 'Book/Chapter.md': 'Text' });
	let onMenu;
	plugin.app.workspace = { on: (name, callback) => { assert.equal(name, 'file-menu'); onMenu = callback; } };
	const tabs = [];
	plugin.addSettingTab = tab => tabs.push(tab);
	plugin.registerEvent = () => {};
	await plugin.onload();
	assert.equal(tabs.length, 1);
	let onClick;
	onMenu({ addItem: callback => callback({ setTitle(title) { this.title = title; return this; }, onClick(callback) { if (this.title === 'Folder fusion') onClick = callback; } }) }, plugin.app.vault.getAbstractFileByPath('Book'));
	plugin.app.vault.read = () => Promise.reject(new Error('Cannot read chapter'));
	notices.length = 0;
	onClick();
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(notices.length, 1);
	assert.match(notices[0], /Cannot read chapter/);
});

test('settings are searchable and legacy controls still persist every existing option', async () => {
	const plugin = await pluginWithFiles();
	const tab = new module.exports.FolderFusionSettingTab({}, plugin);
	const groups = tab.getSettingDefinitions();
	assert.deepEqual(Array.from(groups, group => [group.type, group.heading]), [['group', 'Fusion'], ['group', 'Numbering'], ['group', 'Exclude']]);
	assert.deepEqual(Array.from(groups[1].items, definition => definition.control.key), ['numberingStart', 'numberingIncrement', 'numberingSeparator', 'addFolderName', 'numberFolders']);
	assert.deepEqual(Array.from(groups[2].items, definition => definition.control.key), ['excludeCharacters', 'excludeNames', 'debug']);
	const definitions = Array.from(groups).flatMap(group => Array.from(group.items));
	assert.deepEqual(Array.from(definitions, definition => definition.control.key).sort(), Object.keys(plugin.settings).sort());
	const rows = [];
	tab.containerEl = { rows, empty: () => { rows.length = 0; }, addClass: () => {}, createEl: () => { throw new Error('Unexpected HTML heading'); } };
	let saved;
	plugin.saveData = async value => { saved = { ...value }; };
	tab.display();
	assert.deepEqual(rows.map(row => row.name), Array.from(groups).flatMap(group => [group.heading, ...Array.from(group.items, definition => definition.name)]));
	assert.deepEqual(rows.filter(row => row.heading).map(row => row.name), ['Fusion', 'Numbering', 'Exclude']);
	const controls = rows.filter(row => !row.heading);
	const debug = rows.at(-1);
	assert.equal(debug.name, 'Debug');
	assert.equal(debug.type, 'toggle');
	assert.equal(debug.value, false);
	await debug.change(true);
	assert.equal(saved.debug, true);
	plugin.loadData = async () => saved;
	await plugin.loadSettings();
	assert.equal(plugin.settings.debug, true);
	await debug.change(false);
	assert.equal(plugin.settings.debug, false);
	const link = controls.find(row => row.name === 'Exclude files/folders').desc.children.at(-1);
	assert.deepEqual({ ...link }, { tag: 'a', text: 'Custom Sort', href: 'https://community.obsidian.md/plugins/custom-sort' });
	assert.equal(controls.length, definitions.length);
	for (const [index, definition] of definitions.entries()) {
		const row = controls[index];
		const key = definition.control.key;
		assert.equal(row.name, definition.name);
		assert.equal(row.inputEl.type ?? row.type, definition.control.type);
		assert.equal(row.value, definition.control.type === 'number' ? String(plugin.settings[key]) : plugin.settings[key]);
		const value = definition.control.type === 'number' ? 7 : typeof row.value === 'boolean' ? !row.value : 'test';
		await row.change(definition.control.type === 'number' ? String(value) : value);
		assert.equal(plugin.settings[key], value);
		assert.deepEqual(saved, { ...plugin.settings });
	}
});

test('settings place controls before their text for wrapping and disconnect the observer on unload', async () => {
	const plugin = await pluginWithFiles();
	let cleanup;
	plugin.register = callback => { cleanup = callback; };
	const tab = new module.exports.FolderFusionSettingTab({}, plugin);
	const observer = settingObservers.at(-1);
	assert.equal(observer.target, tab.containerEl);
	assert.deepEqual({ ...observer.options }, { childList: true, subtree: true });
	const control = {};
	let moves = 0;
	const row = {
		firstElementChild: {},
		querySelector: selector => { assert.equal(selector, '.setting-item-control'); return control; },
		prepend(element) { assert.equal(element, control); this.firstElementChild = element; moves++; }
	};
	tab.containerEl.querySelectorAll = selector => { assert.equal(selector, '.setting-item'); return [row]; };
	observer.callback();
	assert.equal(row.firstElementChild, control);
	assert.equal(moves, 1);
	observer.callback();
	assert.equal(moves, 1);
	cleanup();
	assert.equal(observer.disconnected, true);
});

test('settings loading preserves valid saved values and defaults invalid values', async () => {
	const plugin = await pluginWithFiles();
	const defaults = { ...plugin.settings };
	for (const data of [null, [], 'invalid', { smallcaps: 'true', excludeCharacters: false, excludeNames: 42, noteSeparator: 42 }, { numberingStart: -1 }, { numberingStart: 1.5 }, { numberingStart: Number.MAX_SAFE_INTEGER + 1 }, { numberingIncrement: 0 }, { numberingIncrement: -1 }, { numberingIncrement: 1.5 }, { numberingIncrement: Number.MAX_SAFE_INTEGER + 1 }]) {
		plugin.loadData = async () => data;
		await plugin.loadSettings();
		assert.deepEqual({ ...plugin.settings }, defaults);
	}
	const saved = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, typeof value === 'number' ? value + 1 : typeof value === 'boolean' ? !value : 'Saved text']));
	plugin.loadData = async () => saved;
	await plugin.loadSettings();
	assert.deepEqual({ ...plugin.settings }, saved);
	const error = new Error('Cannot read settings');
	plugin.loadData = () => Promise.reject(error);
	await assert.rejects(() => plugin.loadSettings(), caught => caught === error);
});

test('shared exclusions default to underscores anywhere and exact sortspec names', async () => {
	const plugin = await pluginWithFiles({
		'Book/Alpha.md': 'Alpha', 'Book/_Draft.md': 'Draft', 'Book/Work_notes.md': 'Notes',
		'Book/Part_notes/Child.md': 'Child', 'Book/sortspec.md': 'Sort',
		'Book/sortspec/Child.md': 'Sort child', 'Book/sortspec-notes.md': 'Included'
	});
	assert.equal(plugin.settings.numberingSeparator, '-');
	assert.equal(plugin.settings.excludeCharacters, '_');
	assert.equal(plugin.settings.excludeNames, 'sortspec');
	plugin.settings.numberFolders = true;
	assert.equal(await plugin.concatenateFiles('Book'), 'Alpha\n\nIncluded\n\n');
	assert.equal(await plugin.numberFolder('Book'), 2);
	for (const path of ['Book/1-Alpha.md', 'Book/2-sortspec-notes.md', 'Book/_Draft.md', 'Book/Work_notes.md', 'Book/Part_notes/Child.md', 'Book/sortspec.md', 'Book/sortspec/Child.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
});

test('shared character exclusions are literal characters anywhere and empty filters exclude nothing', async () => {
	const plugin = await pluginWithFiles({
		'Book/Alpha.md': 'Alpha', 'Book/[Draft.md': 'Draft', 'Book/Notes].md': 'Notes', 'Book/A😀B.md': 'Emoji'
	});
	plugin.settings.excludeCharacters = '[]😀';
	assert.equal(await plugin.concatenateFiles('Book'), 'Alpha\n\n');
	assert.equal(await plugin.numberFolder('Book'), 1);
	for (const path of ['Book/1-Alpha.md', 'Book/[Draft.md', 'Book/Notes].md', 'Book/A😀B.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
	const unfiltered = await pluginWithFiles({ 'Book/Work_notes.md': 'Notes', 'Book/sortspec.md': 'Sort', 'Book/fusion-Book-20251001-1200.md': 'Snapshot' });
	unfiltered.settings.excludeCharacters = '';
	unfiltered.settings.excludeNames = '';
	assert.equal(await unfiltered.concatenateFiles('Book'), 'Sort\n\nNotes\n\n');
	assert.equal(await unfiltered.numberFolder('Book'), 2);
	assert.ok(unfiltered.app.vault.getAbstractFileByPath('Book/1-sortspec.md'));
	assert.ok(unfiltered.app.vault.getAbstractFileByPath('Book/2-Work_notes.md'));
	assert.ok(unfiltered.app.vault.getAbstractFileByPath('Book/fusion-Book-20251001-1200.md'));
});

test('shared name exclusions match whole names with optional extensions and prune folders', async () => {
	const plugin = await pluginWithFiles({
		'Book/Alpha.md': 'Alpha', 'Book/Skip.md': 'Skip', 'Book/Skip.txt': 'Text',
		'Book/Research/Child.md': 'Child', 'Book/Research notes.md': 'Research notes',
		'Book/[Draft].md': 'Draft', 'Book/archive.tar.gz': 'Archive', 'Book-old/Private.md': 'Private'
	});
	plugin.settings.numberFolders = true;
	plugin.settings.excludeNames = ' skip.md, RESEARCH, [Draft], archive.tar.gz, ';
	const lookup = plugin.app.vault.getAbstractFileByPath;
	Object.defineProperty(lookup('Book/Research'), 'children', { get() { throw new Error('Excluded folders must not be traversed'); } });
	assert.equal(await plugin.concatenateFiles('Book'), 'Alpha\n\nResearch notes\n\nText\n\n');
	assert.equal(await plugin.numberFolder('Book'), 3);
	for (const path of ['Book/1-Alpha.md', 'Book/2-Research notes.md', 'Book/3-Skip.txt', 'Book/Skip.md', 'Book/Research/Child.md', 'Book/[Draft].md', 'Book/archive.tar.gz', 'Book-old/Private.md']) assert.ok(lookup(path));
});

test('numbering follows natural name order and replaces existing prefixes without leaving the folder', async () => {
	const plugin = await pluginWithFiles({
		'Book/10 - Third.md': 'Third', 'Book/2_Second.md': 'Second', 'Book/01 First.md': 'First',
		'Book/Sub/Child.md': 'Child', 'Book-old/Private.md': 'Private'
	});
	plugin.settings.excludeCharacters = '';
	const read = plugin.app.vault.read;
	plugin.app.vault.read = () => { throw new Error('Numbering must not read file contents'); };
	plugin.app.vault.getFiles = () => { throw new Error('Vault enumeration is forbidden'); };
	const lookup = plugin.app.vault.getAbstractFileByPath;
	plugin.app.vault.getAbstractFileByPath = path => {
		assert.ok(path === 'Book' || path.startsWith('Book/'));
		return lookup(path);
	};
	assert.equal(await plugin.numberFolder('Book'), 3);
	assert.equal(await read(lookup('Book/1-First.md')), 'First');
	assert.equal(await read(lookup('Book/2-Second.md')), 'Second');
	assert.equal(await read(lookup('Book/3-Third.md')), 'Third');
	assert.equal(await read(lookup('Book/Sub/Child.md')), 'Child');
	assert.equal(await read(lookup('Book-old/Private.md')), 'Private');
	assert.equal(await plugin.numberFolder('Book'), 0);
});

test('numbering preserves lower prefixes and excluded names and can use a custom or empty separator', async () => {
	for (const separator of [' - ', '', ' chapter ']) {
		const plugin = await pluginWithFiles({
			'Book/01 Intro.md': 'Intro', 'Book/2 Context.md': 'Context',
			'Book/9 Old.md': 'Old', 'Book/Next.md': 'Next', 'Book/Ignore.md': 'Ignore'
		});
		Object.assign(plugin.settings, { numberingStart: 3, numberingSeparator: separator, excludeNames: 'Ignore' });
		assert.equal(await plugin.numberFolder('Book'), 2);
		const lookup = plugin.app.vault.getAbstractFileByPath;
		for (const path of ['Book/01 Intro.md', 'Book/2 Context.md', 'Book/Ignore.md']) assert.ok(lookup(path));
		assert.ok(lookup('Book/3' + separator + 'Old.md'));
		assert.ok(lookup('Book/4' + separator + 'Next.md'));
		assert.equal(await plugin.numberFolder('Book'), 0);
	}
});

test('numbering chooses prefix width automatically, including zero and digit boundaries', async () => {
	for (const [count, start, width] of [[9, 1, 1], [10, 1, 2], [99, 1, 2], [100, 1, 3], [10, 0, 1], [100, 0, 2], [5, 97, 3]]) {
		const plugin = await pluginWithFiles(Object.fromEntries(Array.from({ length: count }, (_, index) => ['Book/Chapter ' + (index + 1) + '.md', String(index)])));
		plugin.settings.numberingStart = start;
		assert.equal(await plugin.numberFolder('Book'), count);
		for (let index = 0; index < count; index++) {
			const file = plugin.app.vault.getAbstractFileByPath('Book/' + String(start + index).padStart(width, '0') + '-Chapter ' + (index + 1) + '.md');
			assert.ok(file);
			assert.equal(await plugin.app.vault.read(file), String(index));
		}
	}
});

test('numbering increment leaves gaps and derives padding from the last assigned number', async () => {
	for (const [start, increment, prefixes] of [[1, 10, ['01', '11', '21']], [10, 10, ['10', '20', '30']], [0, 5, ['00', '05', '10']], [97, 2, ['097', '099', '101']]]) {
		const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha', 'Book/Beta.md': 'Beta', 'Book/Gamma.md': 'Gamma' });
		Object.assign(plugin.settings, { numberingStart: start, numberingIncrement: increment });
		assert.equal(await plugin.numberFolder('Book'), 3);
		for (const [index, title] of ['Alpha', 'Beta', 'Gamma'].entries()) {
			assert.ok(plugin.app.vault.getAbstractFileByPath('Book/' + prefixes[index] + '-' + title + '.md'));
		}
		assert.equal(await plugin.numberFolder('Book'), 0);
	}
});

test('numbering increment is shared by files and folders while protected and excluded items consume no number', async () => {
	const plugin = await pluginWithFiles({ 'Book/01-Intro.md': 'Intro', 'Book/Alpha.md': 'Alpha', 'Book/Beta/Child.md': 'Child', 'Book/Gamma.md': 'Gamma', 'Book/_Draft.md': 'Draft' });
	Object.assign(plugin.settings, { numberingStart: 10, numberingIncrement: 10, numberFolders: true });
	assert.equal(await plugin.numberFolder('Book'), 3);
	for (const path of ['Book/01-Intro.md', 'Book/10-Alpha.md', 'Book/20-Beta/Child.md', 'Book/30-Gamma.md', 'Book/_Draft.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
	assert.equal(await plugin.numberFolder('Book', true), 3);
	for (const path of ['Book/01-Intro.md', 'Book/Alpha.md', 'Book/Beta/Child.md', 'Book/Gamma.md', 'Book/_Draft.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
});

test('Add folder name prefixes eligible files and folders once and preserves exclusions and extensions', async () => {
	const plugin = await pluginWithFiles({
		'Roman/00-Prologue.md': 'Prologue', 'Roman/01-Alpha.md': 'Alpha', 'Roman/02-Beta.md': 'Beta',
		'Roman/Gamma.png': 'Image', 'Roman/Part/Child.md': 'Child', 'Roman/_Draft.md': 'Draft'
	});
	assert.equal(plugin.settings.addFolderName, false);
	Object.assign(plugin.settings, { addFolderName: true, numberFolders: true });
	assert.equal(await plugin.numberFolder('Roman'), 4);
	for (const path of ['Roman/00-Prologue.md', 'Roman/1-Roman-Alpha.md', 'Roman/2-Roman-Beta.md', 'Roman/3-Roman-Gamma.png', 'Roman/4-Roman-Part/Child.md', 'Roman/_Draft.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
	assert.equal(await plugin.numberFolder('Roman'), 0);
	assert.equal(await plugin.numberFolder('Roman', true), 4);
	for (const path of ['Roman/00-Prologue.md', 'Roman/Alpha.md', 'Roman/Beta.md', 'Roman/Gamma.png', 'Roman/Part/Child.md', 'Roman/_Draft.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
	assert.equal(await plugin.numberFolder('Roman'), 4);
	assert.ok(plugin.app.vault.getAbstractFileByPath('Roman/1-Roman-Alpha.md'));
});

test('Add folder name uses the configured separator and stops adding when disabled', async () => {
	for (const separator of [' - ', '']) {
		const plugin = await pluginWithFiles({ 'Roman/Alpha.md': 'Alpha' });
		Object.assign(plugin.settings, { addFolderName: true, numberingSeparator: separator });
		assert.equal(await plugin.numberFolder('Roman'), 1);
		assert.ok(plugin.app.vault.getAbstractFileByPath('Roman/1' + separator + 'Roman' + separator + 'Alpha.md'));
		assert.equal(await plugin.numberFolder('Roman'), 0);
		assert.equal(await plugin.numberFolder('Roman', true), 1);
		assert.ok(plugin.app.vault.getAbstractFileByPath('Roman/Alpha.md'));
		assert.equal(await plugin.numberFolder('Roman'), 1);
		plugin.settings.addFolderName = false;
		assert.equal(await plugin.numberFolder('Roman'), 0);
		assert.equal(await plugin.numberFolder('Roman', true), 1);
		assert.ok(plugin.app.vault.getAbstractFileByPath('Roman/Roman' + separator + 'Alpha.md'));
	}
	const plugin = await pluginWithFiles({ 'Alpha.md': 'Alpha' });
	plugin.settings.addFolderName = true;
	assert.equal(await plugin.numberFolder(''), 1);
	assert.ok(plugin.app.vault.getAbstractFileByPath('1-Alpha.md'));
});

test('numbering optionally renames direct subfolders while leaving their children named as before', async () => {
	const plugin = await pluginWithFiles({ 'Book/02 Part/Child.md': 'Child', 'Book/Note.md': 'Note' });
	plugin.settings.numberFolders = true;
	assert.equal(await plugin.numberFolder('Book'), 2);
	assert.ok(plugin.app.vault.getAbstractFileByPath('Book/1-Part/Child.md'));
	assert.ok(plugin.app.vault.getAbstractFileByPath('Book/2-Note.md'));
});

test('numbering handles occupied source names without overwriting their contents', async () => {
	const plugin = await pluginWithFiles({ 'Book/01 Alpha.md': 'First', 'Book/1-Alpha.md': 'Second' });
	assert.equal(await plugin.numberFolder('Book'), 2);
	assert.equal(await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath('Book/1-Alpha.md')), 'First');
	assert.equal(await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath('Book/2-Alpha.md')), 'Second');
});

test('numbering rejects invalid settings and collisions with excluded files before renaming anything', async () => {
	for (const settings of [
		{ numberingStart: -1 }, { numberingStart: 1.5 }, { numberingStart: Number.MAX_SAFE_INTEGER },
		{ numberingIncrement: 0 }, { numberingIncrement: -1 }, { numberingIncrement: 1.5 }, { numberingIncrement: Number.MAX_SAFE_INTEGER + 1 }, { numberingIncrement: Number.MAX_SAFE_INTEGER },
		{ numberingSeparator: '../' }, { numberingSeparator: '\\' }, { numberingSeparator: '\n' }, { numberingSeparator: '2-' },
		{ excludeNames: '1-alpha' }
	]) {
		const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha', 'Book/Beta.md': 'Beta', 'Book/1-alpha.md': 'Existing' });
		Object.assign(plugin.settings, settings);
		let renamed = 0;
		plugin.app.fileManager.renameFile = async () => { renamed++; };
		await assert.rejects(() => plugin.numberFolder('Book'));
		assert.equal(renamed, 0);
	}
});

test('numbering rejects an empty separator if it would merge the prefix with a numeric title', async () => {
	const plugin = await pluginWithFiles({ 'Book/1 - 2026 Diary.md': 'Diary' });
	plugin.settings.numberingSeparator = '';
	let renamed = 0;
	plugin.app.fileManager.renameFile = async () => { renamed++; };
	await assert.rejects(() => plugin.numberFolder('Book'), /separator is required/);
	assert.equal(renamed, 0);
});

test('numbering restores original names if either renaming phase fails and releases its lock', async () => {
	for (const [failAt, afterRename] of [[2, false], [4, false], [3, true]]) {
		const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha', 'Book/Beta.md': 'Beta' });
		const rename = plugin.app.fileManager.renameFile;
		let calls = 0;
		plugin.app.fileManager.renameFile = async (...args) => {
			calls++;
			if (calls === failAt && !afterRename) throw new Error('Rename failed');
			await rename(...args);
			if (calls === failAt && afterRename) throw new Error('Rename failed');
		};
		await assert.rejects(() => plugin.numberFolder('Book'), /Rename failed/);
		assert.equal(await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath('Book/Alpha.md')), 'Alpha');
		assert.equal(await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath('Book/Beta.md')), 'Beta');
		assert.equal(await plugin.numberFolder('Book'), 2);
	}
});

test('numbering reports original paths if restoring names also fails, preserving every file', async () => {
	const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha', 'Book/Beta.md': 'Beta' });
	const files = [...plugin.app.vault.getAbstractFileByPath('Book').children];
	const rename = plugin.app.fileManager.renameFile;
	let calls = 0;
	plugin.app.fileManager.renameFile = async (...args) => {
		if (++calls >= 2) throw new Error('Storage unavailable');
		await rename(...args);
	};
	await assert.rejects(() => plugin.numberFolder('Book'), error => {
		assert.match(error.message, /Original names could not be fully restored/);
		assert.match(error.message, /-> Book\/Alpha\.md/);
		return true;
	});
	assert.equal(await plugin.app.vault.read(files[0]), 'Alpha');
	assert.equal(await plugin.app.vault.read(files[1]), 'Beta');
	await assert.rejects(() => plugin.numberFolder('Missing'), /Folder not found/);
});

test('numbering stops if another operation moves an item outside the selected folder', async () => {
	const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha', 'Other/Private.md': 'Private' });
	const lookup = plugin.app.vault.getAbstractFileByPath;
	const folder = lookup('Book');
	const other = lookup('Other');
	const file = lookup('Book/Alpha.md');
	const rename = plugin.app.fileManager.renameFile;
	let calls = 0;
	plugin.app.fileManager.renameFile = async (entry, path) => {
		assert.equal(entry.parent, folder);
		assert.ok(path.startsWith('Book/'));
		calls++;
		await rename(entry, path);
		entry.parent.children.splice(entry.parent.children.indexOf(entry), 1);
		entry.parent = other;
		other.children.push(entry);
		entry.path = 'Other/' + entry.name;
	};
	await assert.rejects(() => plugin.numberFolder('Book'), /Folder contents changed/);
	assert.equal(calls, 1);
	assert.equal(await plugin.app.vault.read(file), 'Alpha');
});

test('Folder numbering is offered on folders and the menu applies numbering', async () => {
	const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha' });
	let onMenu;
	plugin.app.workspace = { on: (name, callback) => { onMenu = callback; } };
	plugin.addSettingTab = () => {};
	plugin.registerEvent = () => {};
	await plugin.onload();
	const actions = new Map();
	const menu = { addItem: callback => callback({ setTitle(title) { this.title = title; return this; }, onClick(callback) { actions.set(this.title, callback); } }) };
	onMenu(menu, plugin.app.vault.getAbstractFileByPath('Book/Alpha.md'));
	assert.equal(actions.size, 0);
	onMenu(menu, plugin.app.vault.getAbstractFileByPath('Book'));
	assert.deepEqual([...actions.keys()], ['Folder fusion', 'Folder numbering']);
	notices.length = 0;
	actions.get('Folder numbering')();
	await new Promise(resolve => setImmediate(resolve));
	assert.ok(plugin.app.vault.getAbstractFileByPath('Book/1-Alpha.md'));
	assert.match(notices[0], /1 item renamed/);
	assert.equal(actions.has('Folder unnumbering'), false);
	plugin.settings.debug = true;
	onMenu(menu, plugin.app.vault.getAbstractFileByPath('Book'));
	assert.equal(actions.has('Folder unnumbering'), true);
	notices.length = 0;
	actions.get('Folder unnumbering')();
	await new Promise(resolve => setImmediate(resolve));
	assert.ok(plugin.app.vault.getAbstractFileByPath('Book/Alpha.md'));
	assert.match(notices[0], /Unnumbering complete: 1 item renamed/);
});

test('debug unnumbering removes prefixes and custom separators while respecting scope and exclusions', async () => {
	for (const numberFolders of [false, true]) {
		const plugin = await pluginWithFiles({
			'Book/01 chapter Alpha.md': 'Alpha', 'Book/02-Protected.md': 'Protected',
			'Book/03_Draft.md': 'Draft', 'Book/04-Part/01-Child.md': 'Child',
			'Book/05-Photo.png': 'Photo', 'Book/Unnumbered.md': 'Unnumbered', 'Other/01-Private.md': 'Private'
		});
		Object.assign(plugin.settings, { numberingStart: 1, numberingSeparator: ' chapter ', numberFolders, excludeNames: '02-Protected' });
		assert.equal(await plugin.numberFolder('Book', true), numberFolders ? 3 : 2);
		for (const path of ['Book/Alpha.md', 'Book/Photo.png', 'Book/02-Protected.md', 'Book/03_Draft.md', 'Book/Unnumbered.md', 'Other/01-Private.md', numberFolders ? 'Book/Part/01-Child.md' : 'Book/04-Part/01-Child.md']) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
		assert.equal(await plugin.numberFolder('Book', true), 0);
	}
});

test('unnumbering preserves prefixes below start for files and folders, including zero and padded numbers', async () => {
	for (const start of [0, 3, Number.MAX_SAFE_INTEGER]) {
		const plugin = await pluginWithFiles({
			'Book/00-Zero.md': 'Zero', 'Book/02-Low.md': 'Low', 'Book/003-Boundary.md': 'Boundary',
			'Book/02-Low folder/Child.md': 'Low child', 'Book/003-Boundary folder/Child.md': 'Boundary child',
			'Book/9007199254740991-Limit.md': 'Limit'
		});
		Object.assign(plugin.settings, { numberingStart: start, numberFolders: true });
		assert.equal(await plugin.numberFolder('Book', true), start === 0 ? 6 : start === 3 ? 3 : 1);
		for (const [prefix, title] of [['00', 'Zero.md'], ['02', 'Low.md'], ['003', 'Boundary.md'], ['02', 'Low folder/Child.md'], ['003', 'Boundary folder/Child.md'], ['9007199254740991', 'Limit.md']]) {
			assert.ok(plugin.app.vault.getAbstractFileByPath('Book/' + (Number(prefix) < start ? prefix + '-' : '') + title));
		}
	}
});

test('unnumbering rejects collisions and empty names before any rename', async () => {
	for (const files of [{ 'Book/1-Alpha.md': 'Numbered', 'Book/Alpha.md': 'Existing' }, { 'Book/1-Alpha.md': 'First', 'Book/2-Alpha.md': 'Second' }, { 'Book/01.md': 'Numeric only' }]) {
		const plugin = await pluginWithFiles(files);
		let renames = 0;
		plugin.app.fileManager.renameFile = async () => { renames++; };
		await assert.rejects(() => plugin.numberFolder('Book', true), /Name already exists|empty name/);
		assert.equal(renames, 0);
		for (const path of Object.keys(files)) assert.ok(plugin.app.vault.getAbstractFileByPath(path));
	}
});

test('unnumbering restores numbered names if either renaming phase fails', async () => {
	for (const failAt of [2, 4]) {
		const plugin = await pluginWithFiles({ 'Book/1-Alpha.md': 'Alpha', 'Book/2-Beta.md': 'Beta' });
		const rename = plugin.app.fileManager.renameFile;
		let calls = 0;
		plugin.app.fileManager.renameFile = async (...args) => {
			if (++calls === failAt) throw new Error('Rename failed');
			await rename(...args);
		};
		await assert.rejects(() => plugin.numberFolder('Book', true), /Rename failed/);
		for (const [path, content] of Object.entries({ 'Book/1-Alpha.md': 'Alpha', 'Book/2-Beta.md': 'Beta' })) assert.equal(await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath(path)), content);
		assert.equal(await plugin.numberFolder('Book', true), 2);
	}
});

test('numbering rejects overlapping runs', async () => {
	const plugin = await pluginWithFiles({ 'Book/Alpha.md': 'Alpha' });
	const rename = plugin.app.fileManager.renameFile;
	let release;
	plugin.app.fileManager.renameFile = async (...args) => {
		await new Promise(resolve => { release = resolve; });
		await rename(...args);
	};
	const first = plugin.numberFolder('Book');
	await assert.rejects(() => plugin.numberFolder('Book'), /already running/);
	plugin.app.fileManager.renameFile = rename;
	release();
	await first;
});

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
	plugin.app.vault.getAbstractFileByPath('Book').children = [];
	assert.equal(await plugin.concatenateFiles('Book'), '');
});

test('compilation never enumerates the vault or visits sibling folders', async () => {
	const plugin = await pluginWithFiles({
		'Book/02-Part/Chapter.md': 'Second',
		'Book/01.md': 'First',
		'Book-old/Private.md': 'Private',
		'Other/Private.md': 'Private'
	});
	const selected = plugin.app.vault.getAbstractFileByPath('Book');
	plugin.app.vault.getFiles = () => { throw new Error('Vault-wide enumeration is forbidden'); };
	plugin.app.vault.getMarkdownFiles = () => { throw new Error('Vault-wide enumeration is forbidden'); };
	plugin.app.vault.getAbstractFileByPath = path => {
		assert.equal(path, 'Book');
		return selected;
	};
	const reads = [];
	const read = plugin.app.vault.read;
	plugin.app.vault.read = async file => {
		reads.push(file.path);
		assert.ok(file.path.startsWith('Book/'));
		return read(file);
	};
	assert.equal(await plugin.concatenateFiles('Book'), 'First\n\nSecond\n\n');
	assert.deepEqual(reads, ['Book/01.md', 'Book/02-Part/Chapter.md']);
});

test('compilation rejects a missing folder or a file path before reading contents', async () => {
	const plugin = await pluginWithFiles({ 'Book/Chapter.md': 'Text' });
	plugin.app.vault.read = () => { throw new Error('Unexpected read'); };
	for (const path of ['Missing', 'Book/Chapter.md']) {
		await assert.rejects(() => plugin.concatenateFiles(path), /Folder not found/);
	}
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

test('only the version tag triggers the single release workflow', () => {
	assert.deepEqual(readdirSync(new URL('../.github/workflows/', import.meta.url)).filter(file => /\.ya?ml$/.test(file)), ['release.yml']);
	assert.deepEqual(workflow.on, { push: { tags: ['[0-9]*'] } });
});

test('CI validates the tag against both manifest and package versions', t => {
	const fixture = releaseFixture(t);
	for (const file of ['package.json', 'package-lock.json']) {
		const contents = fixture.json(file);
		contents.version = '1.0.3';
		if (contents.packages) contents.packages[''].version = '1.0.3';
		writeFileSync(join(fixture.directory, file), JSON.stringify(contents));
	}
	const valid = runWorkflowStep('Validate and build', fixture, '1.0.3');
	assert.equal(valid.status, 0, valid.stdout + valid.stderr);
	const wrongTag = runWorkflowStep('Validate and build', fixture, '1.0.4');
	assert.notEqual(wrongTag.status, 0);
	assert.match(wrongTag.stderr, /AssertionError/);
	writeFileSync(join(fixture.directory, 'manifest.json'), JSON.stringify({ ...fixture.json('manifest.json'), version: '1.0.4' }));
	const wrongPackage = runWorkflowStep('Validate and build', fixture, '1.0.4');
	assert.notEqual(wrongPackage.status, 0);
	assert.match(wrongPackage.stderr, /AssertionError/);
});

function releaseFixture(t) {
	const directory = mkdtempSync(join(tmpdir(), 'folder fusion release '));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(join(directory, 'scripts'));
	mkdirSync(join(directory, 'bin'));
	for (const file of ['release.sh', 'scripts/version-bump.mjs']) {
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

test('CI publishes the existing version tag without incrementing it', t => {
	const fixture = releaseFixture(t);
	const manifest = { ...fixture.json('manifest.json'), version: '1.0.4' };
	writeFileSync(join(fixture.directory, 'manifest.json'), JSON.stringify(manifest));
	const valid = runWorkflowStep('Publish plugin', fixture, '1.0.4');
	assert.equal(valid.status, 0, valid.stdout + valid.stderr);
	assert.deepEqual(fixture.commands(), [[
		'gh', 'release', 'create', '1.0.4', 'main.js', 'manifest.json', 'styles.css',
		'--verify-tag', '--title', '1.0.4', '--notes', 'Release 1.0.4'
	]]);
	assert.deepEqual(fixture.json('manifest.json'), manifest);
});
