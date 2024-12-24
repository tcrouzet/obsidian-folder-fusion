import { App, TFolder, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FolderFusionSettings {
    noteSeparator: string;
	exclude: string;
	smallcaps: boolean;
	right: boolean;
	newpage: boolean;
	toppara: boolean;
	poem: boolean;
	hardspaces: boolean;
	nocomments: boolean;
	noMDcomments: boolean;
	apostrophe: boolean;
}

const DEFAULT_SETTINGS: FolderFusionSettings = {
	noteSeparator: '',
	exclude: "sortspec|_i",
	smallcaps: false,
	right: false,
	newpage: false,
	toppara: false,
	poem: false,
	hardspaces: false,
	nocomments: true,
	noMDcomments: true,
	apostrophe: true
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
						   // Appeler votre fonction d'exportation ici
						   this.exportFolder(file.path);
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

	async exportFolder(folderPath:string){
		this.concatenateFiles(folderPath).then(result => {
			this.savingFiles(folderPath,result)
		});
	}

	async concatenateFiles(folderPath: string): Promise<string> {

		const fusionFileRegex = /fusion-.*-\d{8}-\d{4}\.md$/;
		const excludeRegex = new RegExp(this.settings.exclude);

		const files = this.app.vault.getFiles()
			.filter(file => 
				file.path.startsWith(folderPath) && 
				!fusionFileRegex.test(file.path)
			);

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
			}

			if(this.settings.hardspaces){
				fileContent = this.hardspaces(fileContent)
			}

			if(this.settings.apostrophe){
				fileContent = this.apostrophes(fileContent);
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

	hardspaces(content: string) {
		// Extraire les sections HTML et YAML
		const htmlRegex = /<[^>]*>/g;
		const yamlRegex = /---[\s\S]+?---/g;
	
		let htmlMatches = content.match(htmlRegex) || [];
		let yamlMatches = content.match(yamlRegex) || [];
	
		// Remplacer ces sections par des marqueurs temporaires
		content = content.replace(htmlRegex, 'HTML_PLACEHOLDER');
		content = content.replace(yamlRegex, 'YAML_PLACEHOLDER');
	
		// Appliquer les règles d'espacement
		let regex = /(.)([:;?!»])/g;
		content = content.replace(regex, (match, p1, p2) => {
			if (p1 === ' ' || p1 === '\u00A0') {
				return '\u00A0' + p2;
			}
			return p1 + '\u00A0' + p2;
		});
	
		regex = /([«—])(.)?/g;
		content = content.replace(regex, (match, p1, p2) => {
			if (p2 === ' ' || p2 === '\u00A0') {
				return p1 + '\u00A0';
			}
			return p1 + '\u00A0' + p2;
		});
	
		// Réintégrer les sections HTML et YAML
		htmlMatches.forEach(placeholder => {
			content = content.replace('HTML_PLACEHOLDER', placeholder);
		});
		yamlMatches.forEach(placeholder => {
			content = content.replace('YAML_PLACEHOLDER', placeholder);
		});
	
		return content;
	}

	apostrophes(content: string) {
		// Extraire les sections HTML et YAML
		const htmlRegex = /<[^>]*>/g;
		const yamlRegex = /---[\s\S]+?---/g;
	
		let htmlMatches = content.match(htmlRegex) || [];
		let yamlMatches = content.match(yamlRegex) || [];
	
		// Remplacer ces sections par des marqueurs temporaires
		content = content.replace(htmlRegex, 'HTML_PLACEHOLDER');
		content = content.replace(yamlRegex, 'YAML_PLACEHOLDER');

		content = content.replace(/'/g, "’");
	
		// Réintégrer les sections HTML et YAML
		htmlMatches.forEach(placeholder => {
			content = content.replace('HTML_PLACEHOLDER', placeholder);
		});
		yamlMatches.forEach(placeholder => {
			content = content.replace('YAML_PLACEHOLDER', placeholder);
		});
	
		return content;
	}

	poem(content:string) {
			content = content.replace(/€€(.*?)€€/gs, (match, poem) => {
			let paragraphs = poem.split('\n\n');
		
			if (paragraphs.length === 1) {
				return `<div custom-style="poem-solo" class="poem-solo">${paragraphs[0]}</div>\n`;
			} else {
				// Appliquer des styles différents au premier, dernier et aux paragraphes intermédiaires
				let formattedPoem = paragraphs.map((p, index) => {
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		const titleEl = containerEl.createEl('h2', { text: 'Folder Fusion settings' });

		new Setting(containerEl)
			.setName('Small caps')
			.setDesc('Convert --text-- into Pandoc HTML small caps')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.smallcaps)
				.onChange(async (value) => {
					this.plugin.settings.smallcaps = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
		.setName('Apply right style')
		.setDesc('Convert @@paragraph into Pandoc HTML align right')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.right)
			.onChange(async (value) => {
				this.plugin.settings.right = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Applys top-para style')
		.setDesc('Convert ££paragraph into Pandoc Docx top-para')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.toppara)
			.onChange(async (value) => {
				this.plugin.settings.toppara = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('Applys poem style')
		.setDesc('Convert €€paragraph into Pandoc Docx poem')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.poem)
			.onChange(async (value) => {
				this.plugin.settings.poem = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('New page')
		.setDesc('Convert \\newpage into word stype page-break')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.newpage)
			.onChange(async (value) => {
				this.plugin.settings.newpage = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('No HTML comments')
		.setDesc('Remove all <!-- text -->')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.nocomments)
			.onChange(async (value) => {
				this.plugin.settings.nocomments = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('No Markdown comments')
		.setDesc('Remove all %%text%%')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.noMDcomments)
			.onChange(async (value) => {
				this.plugin.settings.noMDcomments = value;
				await this.plugin.saveSettings();
			}));

	
		new Setting(containerEl)
		.setName('Typographic aposttrophes')
		.setDesc('Replace \' with ’')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.apostrophe)
			.onChange(async (value) => {
				this.plugin.settings.apostrophe = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
		.setName('French hard spaces')
		.setDesc('Addapt hard spaces before double ponctuations')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.hardspaces)
			.onChange(async (value) => {
				this.plugin.settings.hardspaces = value;
				await this.plugin.saveSettings();
			}));
	
		new Setting(containerEl)
		.setName('Exclude')
		.setDesc('Regex to exclude files and folders.')
		.addText(text => text
			.setPlaceholder('Enter your files and folders')
			.setValue(this.plugin.settings.exclude)
			.onChange(async (value) => {
				this.plugin.settings.exclude = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl)
			.setName('Note separator')
			.setDesc('You can use Latex \\newpage for example.')
			.addText(text => text
				.setPlaceholder('Enter your separator')
				.setValue(this.plugin.settings.noteSeparator)
				.onChange(async (value) => {
					this.plugin.settings.noteSeparator = value;
					await this.plugin.saveSettings();
				}));
	}
}
