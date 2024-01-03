import { App, Editor, MarkdownView, Modal, Notice, TFolder, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FolderFusionSettings {
    noteSeparator: string;
}

const DEFAULT_SETTINGS: FolderFusionSettings = {
	noteSeparator: ''
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

		const files = this.app.vault.getFiles()
			.filter(file => 
				file.path.startsWith(folderPath) && 
				!fusionFileRegex.test(file.path)
			);

		const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));

		let concatenatedContent = '';
	
		for (const file of sortedFiles) {
			const fileContent = await this.app.vault.read(file);
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

		new Setting(containerEl)
			.setName('Note separator')
			.setDesc('Nothing by default, but you can use Latex \'\\newpage\' for example.')
			.addText(text => text
				.setPlaceholder('Enter your separator')
				.setValue(this.plugin.settings.noteSeparator)
				.onChange(async (value) => {
					this.plugin.settings.noteSeparator = value;
					await this.plugin.saveSettings();
				}));
	}
}
