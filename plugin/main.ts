import { App, TFile, TFolder, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { SettingDefinitionControl } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FolderFusionSettings {
    noteSeparator: string;
	exclude: string;
	smallcaps: boolean;
	right: boolean;
	newpage: boolean;
	toppara: boolean;
	poem: boolean;
	nocomments: boolean;
	noMDcomments: boolean;
}

const DEFAULT_SETTINGS: FolderFusionSettings = {
	noteSeparator: '',
	exclude: "sortspec|_i",
	smallcaps: false,
	right: false,
	newpage: false,
	toppara: false,
	poem: false,
	nocomments: true,
	noMDcomments: true
}

export default class FolderFusion extends Plugin {
	settings: FolderFusionSettings;

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

				/*menu.addItem((item) => {
                    item.setTitle('Duplicate Folder')
                        .onClick(() => {
                            // Appeler la fonction de duplication ici
                            this.duplicateFolder(file.path);
                        });
                });*/
			}
		}));
	}

	async exportFolder(folderPath: string): Promise<void> {
		const result = await this.concatenateFiles(folderPath);
		await this.savingFiles(folderPath, result);
	}

	async concatenateFiles(folderPath: string): Promise<string> {

		const fusionFileRegex = /fusion-.*-\d{8}-\d{4}\.md$/;
		const excludeRegex = new RegExp(this.settings.exclude, "i");

		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) {
			throw new Error(`Folder not found: ${folderPath}`);
		}

		const files: TFile[] = [];
		const pending = [...folder.children];
		while (pending.length) {
			const entry = pending.pop();
			if (entry instanceof TFolder) {
				pending.push(...entry.children);
			} else if (entry instanceof TFile && !fusionFileRegex.test(entry.path)) {
				files.push(entry);
			}
		}

		const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));

		let concatenatedContent = '';
	
		for (const file of sortedFiles) {

			if (excludeRegex.test(file.path)) {
				continue;
			}

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
			if (key === 'noteSeparator' || key === 'exclude') {
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

	getSettingDefinitions(): SettingDefinitionControl<keyof FolderFusionSettings>[] {
		return [
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
				name: 'Exclude',
				desc: 'Regex to exclude files and folders.',
				control: { type: 'text', key: 'exclude', placeholder: 'Enter your files and folders' }
			},
			{
				name: 'Note separator',
				desc: 'You can use Latex \\newpage for example.',
				control: { type: 'text', key: 'noteSeparator', placeholder: 'Enter your separator' }
			}
		];
	}

	display(): void {
		this.containerEl.empty();
		for (const { name, desc, control } of this.getSettingDefinitions()) {
			const setting = new Setting(this.containerEl).setName(name).setDesc(desc ?? '');
			const key = control.key;
			if (key === 'exclude' || key === 'noteSeparator') {
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
