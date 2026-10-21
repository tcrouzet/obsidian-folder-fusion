import { App, TFile, TFolder, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { SettingDefinitionControl, TAbstractFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FolderFusionSettings {
    noteSeparator: string;
	excludeCharacters: string;
	excludeNames: string;
	smallcaps: boolean;
	right: boolean;
	newpage: boolean;
	toppara: boolean;
	poem: boolean;
	nocomments: boolean;
	noMDcomments: boolean;
	numberingStart: number;
	numberingIncrement: number;
	numberingSeparator: string;
	numberFolders: boolean;
	debug: boolean;
}

const DEFAULT_SETTINGS: FolderFusionSettings = {
	noteSeparator: '',
	excludeCharacters: '_',
	excludeNames: 'sortspec',
	smallcaps: false,
	right: false,
	newpage: false,
	toppara: false,
	poem: false,
	nocomments: true,
	noMDcomments: true,
	numberingStart: 1,
	numberingIncrement: 1,
	numberingSeparator: '-',
	numberFolders: false,
	debug: false
}

export default class FolderFusion extends Plugin {
	settings: FolderFusionSettings;
	private numberingInProgress = false;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FolderFusionSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			// Vérifier si l'élément cliqué est un dossier
			if (file instanceof TFolder) {
				// Ajouter une commande d'exportation au menu contextuel
				menu.addItem((item) => {
					item.setTitle('Folder fusion')
						.onClick(() => {
							this.exportFolder(file.path).catch((error: unknown) => {
								new Notice(`Folder fusion failed: ${error instanceof Error ? error.message : String(error)}`);
							});
						});
				});

				menu.addItem(item => {
					item.setTitle('Folder numbering').onClick(() => {
						this.numberFolder(file.path).then(count => {
							new Notice(`Numbering complete: ${count} item${count === 1 ? '' : 's'} renamed.`);
						}).catch((error: unknown) => {
							new Notice(`Folder numbering failed: ${error instanceof Error ? error.message : String(error)}`);
						});
					});
				});
				if (this.settings.debug) {
					menu.addItem(item => {
						item.setTitle('Folder unnumbering').onClick(() => {
							this.numberFolder(file.path, true).then(count => {
								new Notice(`Unnumbering complete: ${count} item${count === 1 ? '' : 's'} renamed.`);
							}).catch((error: unknown) => {
								new Notice(`Folder unnumbering failed: ${error instanceof Error ? error.message : String(error)}`);
							});
						});
					});
				}

			}
		}));
	}

	async exportFolder(folderPath: string): Promise<void> {
		const result = await this.concatenateFiles(folderPath);
		await this.savingFiles(folderPath, result);
	}

	async numberFolder(folderPath: string, removeNumbers = false): Promise<number> {
		if (this.numberingInProgress) throw new Error('Folder numbering is already running.');
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) throw new Error(`Folder not found: ${folderPath}`);
		const { numberingStart: start, numberingIncrement: increment, numberingSeparator: separator } = this.settings;
		if (!Number.isSafeInteger(start) || start < 0) throw new Error('Numbering start must be a non-negative safe integer.');
		if (!removeNumbers && (!Number.isSafeInteger(increment) || increment < 1)) throw new Error('Increment must be a positive safe integer.');
		if (/[\\/:*?"<>|]/.test(separator) || Array.from(separator).some(character => character.charCodeAt(0) < 32)) {
			throw new Error('The numbering separator contains invalid filename characters.');
		}
		if (/^\d/.test(separator)) throw new Error('The numbering separator must not start with a digit.');
		const entries = folder.children.filter((file): file is TFile | TFolder => {
			if (!(file instanceof TFile) && !(file instanceof TFolder && this.settings.numberFolders)) return false;
			if (this.isExcluded(file)) return false;
			const prefix = /^\d+/.exec(file.name);
			return prefix ? Number(prefix[0]) >= start : !removeNumbers;
		}).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
		if (!entries.length) return 0;
		const last = start + (entries.length - 1) * increment;
		if (!removeNumbers && !Number.isSafeInteger(last)) throw new Error('The numbering range exceeds safe integers.');
		const width = String(last).length;
		const parentPath = folder.path;
		const pathFor = (name: string): string => parentPath && parentPath !== '/' ? `${parentPath}/${name}` : name;
		const token = crypto.randomUUID();
		const plan = entries.map((file, index) => {
			const basename = file instanceof TFile ? file.basename : file.name;
			const extension = file instanceof TFile && file.extension ? `.${file.extension}` : '';
			const prefix = /^\d+/.exec(basename);
			let title = prefix ? basename.slice(prefix[0].length) : basename;
			if (prefix) {
				if (separator && title.startsWith(separator)) title = title.slice(separator.length);
				title = title.replace(/^[\s._:-]+/, '');
			}
			if (removeNumbers && !title) throw new Error(`Removing the number would leave an empty name: ${file.path}`);
			if (!removeNumbers && !separator && /^\d/.test(title)) throw new Error('A separator is required before a title starting with a number.');
			const number = String(start + index * increment).padStart(width, '0');
			return {
				file, original: file.path, current: file.path,
				target: pathFor((removeNumbers ? title : number + (title ? separator + title : '')) + extension),
				temporary: pathFor(`folder-fusion-numbering-${token}-${index}${extension}`)
			};
		}).filter(item => item.target !== item.original);
		if (!plan.length) return 0;
		const moving = new Set<TAbstractFile>(plan.map(item => item.file));
		const nameKey = (path: string): string => path.normalize('NFC').toLowerCase();
		const occupied = new Set(folder.children.filter(file => !moving.has(file)).map(file => nameKey(file.path)));
		for (const item of plan) {
			if (item.file.parent !== folder || item.original !== pathFor(item.file.name)) throw new Error('An item is outside the selected folder.');
			if (occupied.has(nameKey(item.target))) throw new Error(`Name already exists: ${item.target}`);
			if (this.app.vault.getAbstractFileByPath(item.temporary)) throw new Error(`Temporary name already exists: ${item.temporary}`);
			occupied.add(nameKey(item.target));
		}

		const rename = async (item: (typeof plan)[number], path: string): Promise<void> => {
			if (folder.path !== parentPath || item.file.parent !== folder || item.file.path !== item.current) {
				throw new Error('Folder contents changed during numbering.');
			}
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing && existing !== item.file) throw new Error(`Name already exists: ${path}`);
			try {
				await this.app.fileManager.renameFile(item.file, path);
			} finally {
				if (item.file.path === path) item.current = path;
			}
		};
		this.numberingInProgress = true;
		try {
			// Temporary names free destinations that are still occupied by another source item.
			for (const item of plan) await rename(item, item.temporary);
			for (const item of plan) await rename(item, item.target);
			return plan.length;
		} catch (error: unknown) {
			const changed = plan.filter(item => item.file.path !== item.original);
			try {
				for (const item of changed) if (item.file.path !== item.temporary) await rename(item, item.temporary);
				for (const item of changed) await rename(item, item.original);
			} catch (restoreError: unknown) {
				const remaining = plan.filter(item => item.file.path !== item.original).map(item => `${item.file.path} -> ${item.original}`).join('\n');
				throw new Error(`Original names could not be fully restored: ${String(restoreError)}\n${remaining}`);
			}
			throw error;
		} finally {
			this.numberingInProgress = false;
		}
	}

	private isExcluded(file: TAbstractFile): boolean {
		const names = this.settings.excludeNames.split(',').map(name => name.trim().toLowerCase()).filter(Boolean);
		return Array.from(this.settings.excludeCharacters).some(character => file.name.includes(character))
			|| names.includes(file.name.toLowerCase())
			|| (file instanceof TFile && names.includes(file.basename.toLowerCase()))
			|| (file instanceof TFile && /fusion-.*-\d{8}-\d{4}\.md$/.test(file.name));
	}

	async concatenateFiles(folderPath: string): Promise<string> {

		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			throw new Error(`Folder not found: ${folderPath}`);
		}

		const files: TFile[] = [];
		const pending = [...folder.children];
		while (pending.length) {
			const entry = pending.pop();
			if (entry && this.isExcluded(entry)) continue;
			if (entry instanceof TFolder) {
				pending.push(...entry.children);
			} else if (entry instanceof TFile) {
				files.push(entry);
			}
		}

		const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));

		let concatenatedContent = '';
	
		for (const file of sortedFiles) {

			let fileContent = await this.app.vault.read(file);

			if(this.settings.nocomments){
				fileContent = fileContent.replace(/<!--[\s\S]*?-->/g, '');
			}

			if(this.settings.noMDcomments){
				fileContent = fileContent.replace(/%%[\s\S]*?%%\n?/g, '');
				fileContent = fileContent.replace(/~~[\s\S]*?~~\n?/g, '');
			}

			if(this.settings.smallcaps){
				fileContent = fileContent.replace(/--(.*?)--/g, '<span style="font-variant:small-caps">$1</span>');
			}

			if(this.settings.right){
				fileContent = fileContent.replace(/@@(.*?)(\n|$)/g, '<div custom-style="Right" class="right" align="right">$1</div>\n');
			}

			if(this.settings.toppara){
				fileContent = fileContent.replace(/££(.*?)(\n|$)/g, '<div custom-style="top-para" class="top-para" style="text-align:justify">$1</div>\n');
			}

			if(this.settings.poem){
				//fileContent = fileContent.replace(/€€([\s\S]*?)(?=\n\n|$)/g, '<div custom-style="poem" class="poem">$1</div>\n');
				fileContent = this.poem(fileContent);
			}

			if(this.settings.newpage){
				fileContent = fileContent.replace(/\\newpage/g, '<div custom-style="page-break" class="page-beak" style="page-break-after: always">-</div>');
			}

			concatenatedContent += fileContent + '\n\n'; // Ajouter une séparation entre les fichiers
			concatenatedContent += this.settings.noteSeparator;
		}

		// Process notes after concatenation
		concatenatedContent = this.processNotes(concatenatedContent);
	
		return concatenatedContent;
	}

	async savingFiles(folderPath: string,content: string) {
		const folderName = this.getFolderNameFromPath(folderPath);
		const currentDate = new Date();
		const formattedDate = currentDate.toISOString().slice(0, 10).replace(/-/g, '') + '-' + currentDate.toISOString().slice(11, 13) + currentDate.toISOString().slice(14, 16);
		const tempFilePath = `${folderPath}/fusion-${folderName}-${formattedDate}.md`;
		await this.app.vault.adapter.write(tempFilePath, content);
	}

	getFolderNameFromPath(folderPath:string) {
		const pathParts = folderPath.split('/');
		return pathParts[pathParts.length - 1];
	}

	processNotes(content: string): string {
		// return content;
		// Regex pour trouver les appels de notes et les définitions
		const noteCallRegex = /\[\^(\d+)\]/g;
		const noteDefRegex = /\[\^(\d+)\][ \n]*:[ \n]*([^\n]+)/g;
	
		// Collecter toutes les notes et leurs définitions
		const notes = new Map<number, string>();
		let match;
		
		// Extraire toutes les définitions de notes
		let noneN = 1;
		while ((match = noteDefRegex.exec(content)) !== null) {
			const text = match[2].trim();
			notes.set(noneN, text);
			noneN +=1;
		}
	
		// Supprimer les définitions de notes originales
		content = content.replace(noteDefRegex, '');
	
		// Renumérote notes
		let noteCounter = 1;
		content = content.replace(noteCallRegex, () => {
			return `[^${noteCounter++}]`;
		});

		// Construire les notes et les ajouter à la fin
		if (notes.size > 0) {
			let notesText = '';
			for (let i = 1; i <= notes.size; i++) {
				notesText += `[^${i}]: ${notes.get(i)}\n\n`;
			}
			content = content.trim() + '\n\n' + notesText.trim();
		}

		return content;
	}

	poem(content: string): string {
		// content = content.replace(/€€(.*?)€€/gs, (match, poem) => {
		content = content.replace(/€€([\s\S]*?)€€/g, (_match: string, poem: string) => {

			const paragraphs = poem.split('\n\n');
		
			if (paragraphs.length === 1) {
				return `<div custom-style="poem-solo" class="poem-solo">${paragraphs[0]}</div>\n`;
			} else {
				// Appliquer des styles différents au premier, dernier et aux paragraphes intermédiaires
				const formattedPoem = paragraphs.map((p: string, index: number) => {
					if (index === 0) {
						return `<div custom-style="poem-top" class="poem-top">${p}</div>\n`;
					} else if (index === paragraphs.length - 1) {
						return `<div custom-style="poem-bottom" class="poem-bottom">${p}</div>`;
					} else {
						return `<div custom-style="poem" class="poem">${p}</div>\n`;
					}
				}).join('\n');
		
				return formattedPoem;
			}
		});
		return content;
	}

	async duplicateFolder(folderPath:string) {

	}

	async loadSettings() {
		const data: unknown = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS };
		if (typeof data !== 'object' || data === null) return;

		for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof FolderFusionSettings)[]) {
			const value = (data as Record<string, unknown>)[key];
			if (key === 'numberingStart' || key === 'numberingIncrement') {
				const minimum = key === 'numberingIncrement' ? 1 : 0;
				if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) this.settings[key] = value;
			} else if (key === 'noteSeparator' || key === 'excludeCharacters' || key === 'excludeNames' || key === 'numberingSeparator') {
				if (typeof value === 'string') this.settings[key] = value;
			} else if (typeof value === 'boolean') {
				this.settings[key] = value;
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
	}

}

class FolderFusionSettingTab extends PluginSettingTab {
	plugin: FolderFusion;

	constructor(app: App, plugin: FolderFusion) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): {
		type: 'group';
		heading: string;
		cls: string;
		items: SettingDefinitionControl<keyof FolderFusionSettings>[];
	}[] {
		return [
			{
				type: 'group',
				heading: 'Fusion',
				cls: 'folder-fusion-settings',
				items: [
					{
						name: 'Small caps',
						desc: 'Convert --text-- into Pandoc HTML small caps',
						control: { type: 'toggle', key: 'smallcaps' }
					},
					{
						name: 'Apply right style',
						desc: 'Convert @@paragraph into Pandoc HTML align right',
						control: { type: 'toggle', key: 'right' }
					},
					{
						name: 'Applys top-para style',
						desc: 'Convert ££paragraph into Pandoc Docx top-para',
						control: { type: 'toggle', key: 'toppara' }
					},
					{
						name: 'Applys poem style',
						desc: 'Convert €€paragraph into Pandoc Docx poem',
						control: { type: 'toggle', key: 'poem' }
					},
					{
						name: 'New page',
						desc: 'Convert \\newpage into word stype page-break',
						control: { type: 'toggle', key: 'newpage' }
					},
					{
						name: 'No HTML comments',
						desc: 'Remove all <!-- text -->',
						control: { type: 'toggle', key: 'nocomments' }
					},
					{
						name: 'No Markdown comments and strikethrough',
						desc: 'Remove all %%text%% and ~~text~~',
						control: { type: 'toggle', key: 'noMDcomments' }
					},
					{
						name: 'Note separator',
						desc: 'You can use Latex \\newpage for example.',
						control: { type: 'text', key: 'noteSeparator', placeholder: 'Enter your separator' }
					}
				]
			},
			{
				type: 'group',
				heading: 'Numbering',
				cls: 'folder-fusion-settings',
				items: [
					{
						name: 'Numbering start',
						desc: 'First number to assign. Numbering and unnumbering leave existing prefixes below this number unchanged.',
						control: { type: 'number', key: 'numberingStart', min: 0, max: Number.MAX_SAFE_INTEGER, step: 1 }
					},
					{
						name: 'Increment',
						desc: 'Step between consecutive numbers. Values greater than 1 leave room to insert chapters between existing ones.',
						control: { type: 'number', key: 'numberingIncrement', min: 1, max: Number.MAX_SAFE_INTEGER, step: 1 }
					},
					{
						name: 'Numbering separator',
						desc: 'Text between the number and the name. A hyphen is used by default.',
						control: { type: 'text', key: 'numberingSeparator' }
					},
					{
						name: 'Number folders',
						desc: 'Also number direct subfolders. Their contents are not numbered.',
						control: { type: 'toggle', key: 'numberFolders' }
					}
				]
			},
			{
				type: 'group',
				heading: 'Exclude',
				cls: 'folder-fusion-settings',
				items: [
					{
						name: 'Exclude characters',
						desc: 'Ignore files and folders whose names contain any of these characters. Applies to Fusion and Numbering. Empty disables this filter.',
						control: { type: 'text', key: 'excludeCharacters' }
					},
					{
						name: 'Exclude files/folders',
						desc: createFragment(fragment => {
							fragment.appendText('Comma-separated full names, with or without file extension. Case-insensitive. Applies to Fusion and Numbering. Empty disables this filter. Default sortspec is used by ');
							fragment.createEl('a', { text: 'Custom Sort', href: 'https://community.obsidian.md/plugins/custom-sort' });
						}),
						control: { type: 'text', key: 'excludeNames' }
					},
					{
						name: 'Debug',
						desc: 'Show Folder unnumbering in the folder menu. It removes numeric prefixes at or above Numbering start and respects exclusions.',
						control: { type: 'toggle', key: 'debug' }
					}
				]
			}
		];
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.addClass('folder-fusion-settings');
		for (const group of this.getSettingDefinitions()) {
			new Setting(this.containerEl).setName(group.heading).setHeading();
			for (const definition of group.items) {
				const setting = new Setting(this.containerEl).setName(definition.name).setDesc(definition.desc ?? '');
				const { control } = definition;
				const key = control.key;
				if (key === 'numberingStart' || key === 'numberingIncrement') {
					const minimum = key === 'numberingIncrement' ? 1 : 0;
					setting.addText(text => {
						text.inputEl.type = 'number';
						text.inputEl.min = String(minimum);
						text.inputEl.step = '1';
						text.setValue(String(this.plugin.settings[key])).onChange(async value => {
							const number = Number(value);
							if (!value.trim() || !Number.isSafeInteger(number) || number < minimum) return;
							this.plugin.settings[key] = number;
							await this.plugin.saveSettings();
						});
					});
				} else if (key === 'excludeCharacters' || key === 'excludeNames' || key === 'noteSeparator' || key === 'numberingSeparator') {
					setting.addText(text => text
						.setPlaceholder(control.type === 'text' ? control.placeholder ?? '' : '')
						.setValue(this.plugin.settings[key])
						.onChange(async value => {
							this.plugin.settings[key] = value;
							await this.plugin.saveSettings();
						}));
				} else {
					setting.addToggle(toggle => toggle
						.setValue(this.plugin.settings[key])
						.onChange(async value => {
							this.plugin.settings[key] = value;
							await this.plugin.saveSettings();
						}));
				}
			}
		}
	}
}
