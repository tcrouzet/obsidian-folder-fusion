/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FolderFusion
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  noteSeparator: "",
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
};
var FolderFusion = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FolderFusionSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof import_obsidian.TFolder) {
        menu.addItem((item) => {
          item.setTitle("Folder fusion").onClick(() => {
            this.exportFolder(file.path);
          });
        });
      }
    }));
  }
  async exportFolder(folderPath) {
    this.concatenateFiles(folderPath).then((result) => {
      this.savingFiles(folderPath, result);
    });
  }
  async concatenateFiles(folderPath) {
    const fusionFileRegex = /fusion-.*-\d{8}-\d{4}\.md$/;
    const excludeRegex = new RegExp(this.settings.exclude);
    const files = this.app.vault.getFiles().filter(
      (file) => file.path.startsWith(folderPath) && !fusionFileRegex.test(file.path)
    );
    const sortedFiles = files.sort((a, b) => a.path.localeCompare(b.path));
    let concatenatedContent = "";
    for (const file of sortedFiles) {
      if (excludeRegex.test(file.path)) {
        continue;
      }
      let fileContent = await this.app.vault.read(file);
      if (this.settings.nocomments) {
        fileContent = fileContent.replace(/<!--[\s\S]*?-->/g, "");
      }
      if (this.settings.noMDcomments) {
        fileContent = fileContent.replace(/%%[\s\S]*?%%\n?/g, "");
      }
      if (this.settings.hardspaces) {
        fileContent = this.hardspaces(fileContent);
      }
      if (this.settings.apostrophe) {
        fileContent = this.apostrophes(fileContent);
      }
      if (this.settings.smallcaps) {
        fileContent = fileContent.replace(/--(.*?)--/g, '<span style="font-variant:small-caps">$1</span>');
      }
      if (this.settings.right) {
        fileContent = fileContent.replace(/@@(.*?)(\n|$)/g, '<div custom-style="Right" class="right" align="right">$1</div>\n');
      }
      if (this.settings.toppara) {
        fileContent = fileContent.replace(/££(.*?)(\n|$)/g, '<div custom-style="top-para" class="top-para" style="text-align:justify">$1</div>\n');
      }
      if (this.settings.poem) {
        fileContent = this.poem(fileContent);
      }
      if (this.settings.newpage) {
        fileContent = fileContent.replace(/\\newpage/g, '<div custom-style="page-break" class="page-beak" style="page-break-after: always">-</div>');
      }
      concatenatedContent += fileContent + "\n\n";
      concatenatedContent += this.settings.noteSeparator;
    }
    return concatenatedContent;
  }
  async savingFiles(folderPath, content) {
    const folderName = this.getFolderNameFromPath(folderPath);
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().slice(0, 10).replace(/-/g, "") + "-" + currentDate.toISOString().slice(11, 13) + currentDate.toISOString().slice(14, 16);
    const tempFilePath = `${folderPath}/fusion-${folderName}-${formattedDate}.md`;
    await this.app.vault.adapter.write(tempFilePath, content);
  }
  getFolderNameFromPath(folderPath) {
    const pathParts = folderPath.split("/");
    return pathParts[pathParts.length - 1];
  }
  hardspaces(content) {
    const htmlRegex = /<[^>]*>/g;
    const yamlRegex = /---[\s\S]+?---/g;
    let htmlMatches = content.match(htmlRegex) || [];
    let yamlMatches = content.match(yamlRegex) || [];
    content = content.replace(htmlRegex, "HTML_PLACEHOLDER");
    content = content.replace(yamlRegex, "YAML_PLACEHOLDER");
    let regex = /(.)([:;?!»])/g;
    content = content.replace(regex, (match, p1, p2) => {
      if (p1 === " " || p1 === "\xA0") {
        return "\xA0" + p2;
      }
      return p1 + "\xA0" + p2;
    });
    regex = /([«—])(.)?/g;
    content = content.replace(regex, (match, p1, p2) => {
      if (p2 === " " || p2 === "\xA0") {
        return p1 + "\xA0";
      }
      return p1 + "\xA0" + p2;
    });
    htmlMatches.forEach((placeholder) => {
      content = content.replace("HTML_PLACEHOLDER", placeholder);
    });
    yamlMatches.forEach((placeholder) => {
      content = content.replace("YAML_PLACEHOLDER", placeholder);
    });
    return content;
  }
  apostrophes(content) {
    const htmlRegex = /<[^>]*>/g;
    const yamlRegex = /---[\s\S]+?---/g;
    let htmlMatches = content.match(htmlRegex) || [];
    let yamlMatches = content.match(yamlRegex) || [];
    content = content.replace(htmlRegex, "HTML_PLACEHOLDER");
    content = content.replace(yamlRegex, "YAML_PLACEHOLDER");
    content = content.replace(/'/g, "\u2019");
    htmlMatches.forEach((placeholder) => {
      content = content.replace("HTML_PLACEHOLDER", placeholder);
    });
    yamlMatches.forEach((placeholder) => {
      content = content.replace("YAML_PLACEHOLDER", placeholder);
    });
    return content;
  }
  poem(content) {
    content = content.replace(/€€(.*?)€€/gs, (match, poem) => {
      let paragraphs = poem.split("\n\n");
      if (paragraphs.length === 1) {
        return `<div custom-style="poem-solo" class="poem-solo">${paragraphs[0]}</div>
`;
      } else {
        let formattedPoem = paragraphs.map((p, index) => {
          if (index === 0) {
            return `<div custom-style="poem-top" class="poem-top">${p}</div>
`;
          } else if (index === paragraphs.length - 1) {
            return `<div custom-style="poem-bottom" class="poem-bottom">${p}</div>`;
          } else {
            return `<div custom-style="poem" class="poem">${p}</div>
`;
          }
        }).join("\n");
        return formattedPoem;
      }
    });
    return content;
  }
  async duplicateFolder(folderPath) {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
  }
};
var FolderFusionSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const titleEl = containerEl.createEl("h2", { text: "Folder Fusion settings" });
    new import_obsidian.Setting(containerEl).setName("Small caps").setDesc("Convert --text-- into Pandoc HTML small caps").addToggle((toggle) => toggle.setValue(this.plugin.settings.smallcaps).onChange(async (value) => {
      this.plugin.settings.smallcaps = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Apply right style").setDesc("Convert @@paragraph into Pandoc HTML align right").addToggle((toggle) => toggle.setValue(this.plugin.settings.right).onChange(async (value) => {
      this.plugin.settings.right = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Applys top-para style").setDesc("Convert \xA3\xA3paragraph into Pandoc Docx top-para").addToggle((toggle) => toggle.setValue(this.plugin.settings.toppara).onChange(async (value) => {
      this.plugin.settings.toppara = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Applys poem style").setDesc("Convert \u20AC\u20ACparagraph into Pandoc Docx poem").addToggle((toggle) => toggle.setValue(this.plugin.settings.poem).onChange(async (value) => {
      this.plugin.settings.poem = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("New page").setDesc("Convert \\newpage into word stype page-break").addToggle((toggle) => toggle.setValue(this.plugin.settings.newpage).onChange(async (value) => {
      this.plugin.settings.newpage = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("No HTML comments").setDesc("Remove all <!-- text -->").addToggle((toggle) => toggle.setValue(this.plugin.settings.nocomments).onChange(async (value) => {
      this.plugin.settings.nocomments = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("No Markdown comments").setDesc("Remove all %%text%%").addToggle((toggle) => toggle.setValue(this.plugin.settings.noMDcomments).onChange(async (value) => {
      this.plugin.settings.noMDcomments = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Typographic aposttrophes").setDesc("Replace ' with \u2019").addToggle((toggle) => toggle.setValue(this.plugin.settings.apostrophe).onChange(async (value) => {
      this.plugin.settings.apostrophe = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("French hard spaces").setDesc("Addapt hard spaces before double ponctuations").addToggle((toggle) => toggle.setValue(this.plugin.settings.hardspaces).onChange(async (value) => {
      this.plugin.settings.hardspaces = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Exclude").setDesc("Regex to exclude files and folders.").addText((text) => text.setPlaceholder("Enter your files and folders").setValue(this.plugin.settings.exclude).onChange(async (value) => {
      this.plugin.settings.exclude = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Note separator").setDesc("You can use Latex \\newpage for example.").addText((text) => text.setPlaceholder("Enter your separator").setValue(this.plugin.settings.noteSeparator).onChange(async (value) => {
      this.plugin.settings.noteSeparator = value;
      await this.plugin.saveSettings();
    }));
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQXBwLCBURm9sZGVyLCBQbHVnaW4sIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tICdvYnNpZGlhbic7XG5cbi8vIFJlbWVtYmVyIHRvIHJlbmFtZSB0aGVzZSBjbGFzc2VzIGFuZCBpbnRlcmZhY2VzIVxuXG5pbnRlcmZhY2UgRm9sZGVyRnVzaW9uU2V0dGluZ3Mge1xuICAgIG5vdGVTZXBhcmF0b3I6IHN0cmluZztcblx0ZXhjbHVkZTogc3RyaW5nO1xuXHRzbWFsbGNhcHM6IGJvb2xlYW47XG5cdHJpZ2h0OiBib29sZWFuO1xuXHRuZXdwYWdlOiBib29sZWFuO1xuXHR0b3BwYXJhOiBib29sZWFuO1xuXHRwb2VtOiBib29sZWFuO1xuXHRoYXJkc3BhY2VzOiBib29sZWFuO1xuXHRub2NvbW1lbnRzOiBib29sZWFuO1xuXHRub01EY29tbWVudHM6IGJvb2xlYW47XG5cdGFwb3N0cm9waGU6IGJvb2xlYW47XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEZvbGRlckZ1c2lvblNldHRpbmdzID0ge1xuXHRub3RlU2VwYXJhdG9yOiAnJyxcblx0ZXhjbHVkZTogXCJzb3J0c3BlY3xfaVwiLFxuXHRzbWFsbGNhcHM6IGZhbHNlLFxuXHRyaWdodDogZmFsc2UsXG5cdG5ld3BhZ2U6IGZhbHNlLFxuXHR0b3BwYXJhOiBmYWxzZSxcblx0cG9lbTogZmFsc2UsXG5cdGhhcmRzcGFjZXM6IGZhbHNlLFxuXHRub2NvbW1lbnRzOiB0cnVlLFxuXHRub01EY29tbWVudHM6IHRydWUsXG5cdGFwb3N0cm9waGU6IHRydWVcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRm9sZGVyRnVzaW9uIGV4dGVuZHMgUGx1Z2luIHtcblx0c2V0dGluZ3M6IEZvbGRlckZ1c2lvblNldHRpbmdzO1xuXG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Ly8gVGhpcyBhZGRzIGEgc2V0dGluZ3MgdGFiIHNvIHRoZSB1c2VyIGNhbiBjb25maWd1cmUgdmFyaW91cyBhc3BlY3RzIG9mIHRoZSBwbHVnaW5cblx0XHR0aGlzLmFkZFNldHRpbmdUYWIobmV3IEZvbGRlckZ1c2lvblNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlKSA9PiB7XG5cdFx0XHQvLyBWXHUwMEU5cmlmaWVyIHNpIGwnXHUwMEU5bFx1MDBFOW1lbnQgY2xpcXVcdTAwRTkgZXN0IHVuIGRvc3NpZXJcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xuXHRcdFx0XHQvLyBBam91dGVyIHVuZSBjb21tYW5kZSBkJ2V4cG9ydGF0aW9uIGF1IG1lbnUgY29udGV4dHVlbFxuXHRcdFx0XHRtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRpdGVtLnNldFRpdGxlKCdGb2xkZXIgZnVzaW9uJylcblx0XHRcdFx0XHQgICAub25DbGljaygoKSA9PiB7XG5cdFx0XHRcdFx0XHQgICAvLyBBcHBlbGVyIHZvdHJlIGZvbmN0aW9uIGQnZXhwb3J0YXRpb24gaWNpXG5cdFx0XHRcdFx0XHQgICB0aGlzLmV4cG9ydEZvbGRlcihmaWxlLnBhdGgpO1xuXHRcdFx0XHRcdCAgIH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvKm1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpdGVtLnNldFRpdGxlKCdEdXBsaWNhdGUgRm9sZGVyJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBcHBlbGVyIGxhIGZvbmN0aW9uIGRlIGR1cGxpY2F0aW9uIGljaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHVwbGljYXRlRm9sZGVyKGZpbGUucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTsqL1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGFzeW5jIGV4cG9ydEZvbGRlcihmb2xkZXJQYXRoOnN0cmluZyl7XG5cdFx0dGhpcy5jb25jYXRlbmF0ZUZpbGVzKGZvbGRlclBhdGgpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdHRoaXMuc2F2aW5nRmlsZXMoZm9sZGVyUGF0aCxyZXN1bHQpXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBjb25jYXRlbmF0ZUZpbGVzKGZvbGRlclBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cblx0XHRjb25zdCBmdXNpb25GaWxlUmVnZXggPSAvZnVzaW9uLS4qLVxcZHs4fS1cXGR7NH1cXC5tZCQvO1xuXHRcdGNvbnN0IGV4Y2x1ZGVSZWdleCA9IG5ldyBSZWdFeHAodGhpcy5zZXR0aW5ncy5leGNsdWRlKTtcblxuXG5cdFx0Y29uc3QgZmlsZXMgPSB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpXG5cdFx0XHQuZmlsdGVyKGZpbGUgPT4gXG5cdFx0XHRcdGZpbGUucGF0aC5zdGFydHNXaXRoKGZvbGRlclBhdGgpICYmIFxuXHRcdFx0XHQhZnVzaW9uRmlsZVJlZ2V4LnRlc3QoZmlsZS5wYXRoKVxuXHRcdFx0KTtcblxuXHRcdGNvbnN0IHNvcnRlZEZpbGVzID0gZmlsZXMuc29ydCgoYSwgYikgPT4gYS5wYXRoLmxvY2FsZUNvbXBhcmUoYi5wYXRoKSk7XG5cblx0XHRsZXQgY29uY2F0ZW5hdGVkQ29udGVudCA9ICcnO1xuXHRcblx0XHRmb3IgKGNvbnN0IGZpbGUgb2Ygc29ydGVkRmlsZXMpIHtcblxuXHRcdFx0aWYgKGV4Y2x1ZGVSZWdleC50ZXN0KGZpbGUucGF0aCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cblx0XHRcdGlmKHRoaXMuc2V0dGluZ3Mubm9jb21tZW50cyl7XG5cdFx0XHRcdGZpbGVDb250ZW50ID0gZmlsZUNvbnRlbnQucmVwbGFjZSgvPCEtLVtcXHNcXFNdKj8tLT4vZywgJycpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZih0aGlzLnNldHRpbmdzLm5vTURjb21tZW50cyl7XG5cdFx0XHRcdGZpbGVDb250ZW50ID0gZmlsZUNvbnRlbnQucmVwbGFjZSgvJSVbXFxzXFxTXSo/JSVcXG4/L2csICcnKTtcblx0XHRcdH1cblxuXHRcdFx0aWYodGhpcy5zZXR0aW5ncy5oYXJkc3BhY2VzKXtcblx0XHRcdFx0ZmlsZUNvbnRlbnQgPSB0aGlzLmhhcmRzcGFjZXMoZmlsZUNvbnRlbnQpXG5cdFx0XHR9XG5cblx0XHRcdGlmKHRoaXMuc2V0dGluZ3MuYXBvc3Ryb3BoZSl7XG5cdFx0XHRcdGZpbGVDb250ZW50ID0gdGhpcy5hcG9zdHJvcGhlcyhmaWxlQ29udGVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmKHRoaXMuc2V0dGluZ3Muc21hbGxjYXBzKXtcblx0XHRcdFx0ZmlsZUNvbnRlbnQgPSBmaWxlQ29udGVudC5yZXBsYWNlKC8tLSguKj8pLS0vZywgJzxzcGFuIHN0eWxlPVwiZm9udC12YXJpYW50OnNtYWxsLWNhcHNcIj4kMTwvc3Bhbj4nKTtcblx0XHRcdH1cblxuXHRcdFx0aWYodGhpcy5zZXR0aW5ncy5yaWdodCl7XG5cdFx0XHRcdGZpbGVDb250ZW50ID0gZmlsZUNvbnRlbnQucmVwbGFjZSgvQEAoLio/KShcXG58JCkvZywgJzxkaXYgY3VzdG9tLXN0eWxlPVwiUmlnaHRcIiBjbGFzcz1cInJpZ2h0XCIgYWxpZ249XCJyaWdodFwiPiQxPC9kaXY+XFxuJyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmKHRoaXMuc2V0dGluZ3MudG9wcGFyYSl7XG5cdFx0XHRcdGZpbGVDb250ZW50ID0gZmlsZUNvbnRlbnQucmVwbGFjZSgvXHUwMEEzXHUwMEEzKC4qPykoXFxufCQpL2csICc8ZGl2IGN1c3RvbS1zdHlsZT1cInRvcC1wYXJhXCIgY2xhc3M9XCJ0b3AtcGFyYVwiIHN0eWxlPVwidGV4dC1hbGlnbjpqdXN0aWZ5XCI+JDE8L2Rpdj5cXG4nKTtcblx0XHRcdH1cblxuXHRcdFx0aWYodGhpcy5zZXR0aW5ncy5wb2VtKXtcblx0XHRcdFx0Ly9maWxlQ29udGVudCA9IGZpbGVDb250ZW50LnJlcGxhY2UoL1x1MjBBQ1x1MjBBQyhbXFxzXFxTXSo/KSg/PVxcblxcbnwkKS9nLCAnPGRpdiBjdXN0b20tc3R5bGU9XCJwb2VtXCIgY2xhc3M9XCJwb2VtXCI+JDE8L2Rpdj5cXG4nKTtcblx0XHRcdFx0ZmlsZUNvbnRlbnQgPSB0aGlzLnBvZW0oZmlsZUNvbnRlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZih0aGlzLnNldHRpbmdzLm5ld3BhZ2Upe1xuXHRcdFx0XHRmaWxlQ29udGVudCA9IGZpbGVDb250ZW50LnJlcGxhY2UoL1xcXFxuZXdwYWdlL2csICc8ZGl2IGN1c3RvbS1zdHlsZT1cInBhZ2UtYnJlYWtcIiBjbGFzcz1cInBhZ2UtYmVha1wiIHN0eWxlPVwicGFnZS1icmVhay1hZnRlcjogYWx3YXlzXCI+LTwvZGl2PicpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25jYXRlbmF0ZWRDb250ZW50ICs9IGZpbGVDb250ZW50ICsgJ1xcblxcbic7IC8vIEFqb3V0ZXIgdW5lIHNcdTAwRTlwYXJhdGlvbiBlbnRyZSBsZXMgZmljaGllcnNcblx0XHRcdGNvbmNhdGVuYXRlZENvbnRlbnQgKz0gdGhpcy5zZXR0aW5ncy5ub3RlU2VwYXJhdG9yO1xuXHRcdH1cblx0XG5cdFx0cmV0dXJuIGNvbmNhdGVuYXRlZENvbnRlbnQ7XG5cdH1cblxuXHRhc3luYyBzYXZpbmdGaWxlcyhmb2xkZXJQYXRoOiBzdHJpbmcsY29udGVudDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZm9sZGVyTmFtZSA9IHRoaXMuZ2V0Rm9sZGVyTmFtZUZyb21QYXRoKGZvbGRlclBhdGgpO1xuXHRcdGNvbnN0IGN1cnJlbnREYXRlID0gbmV3IERhdGUoKTtcblx0XHRjb25zdCBmb3JtYXR0ZWREYXRlID0gY3VycmVudERhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCkucmVwbGFjZSgvLS9nLCAnJykgKyAnLScgKyBjdXJyZW50RGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDExLCAxMykgKyBjdXJyZW50RGF0ZS50b0lTT1N0cmluZygpLnNsaWNlKDE0LCAxNik7XG5cdFx0Y29uc3QgdGVtcEZpbGVQYXRoID0gYCR7Zm9sZGVyUGF0aH0vZnVzaW9uLSR7Zm9sZGVyTmFtZX0tJHtmb3JtYXR0ZWREYXRlfS5tZGA7XG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZSh0ZW1wRmlsZVBhdGgsIGNvbnRlbnQpO1xuXHR9XG5cblx0Z2V0Rm9sZGVyTmFtZUZyb21QYXRoKGZvbGRlclBhdGg6c3RyaW5nKSB7XG5cdFx0Y29uc3QgcGF0aFBhcnRzID0gZm9sZGVyUGF0aC5zcGxpdCgnLycpO1xuXHRcdHJldHVybiBwYXRoUGFydHNbcGF0aFBhcnRzLmxlbmd0aCAtIDFdO1xuXHR9XG5cblx0aGFyZHNwYWNlcyhjb250ZW50OiBzdHJpbmcpIHtcblx0XHQvLyBFeHRyYWlyZSBsZXMgc2VjdGlvbnMgSFRNTCBldCBZQU1MXG5cdFx0Y29uc3QgaHRtbFJlZ2V4ID0gLzxbXj5dKj4vZztcblx0XHRjb25zdCB5YW1sUmVnZXggPSAvLS0tW1xcc1xcU10rPy0tLS9nO1xuXHRcblx0XHRsZXQgaHRtbE1hdGNoZXMgPSBjb250ZW50Lm1hdGNoKGh0bWxSZWdleCkgfHwgW107XG5cdFx0bGV0IHlhbWxNYXRjaGVzID0gY29udGVudC5tYXRjaCh5YW1sUmVnZXgpIHx8IFtdO1xuXHRcblx0XHQvLyBSZW1wbGFjZXIgY2VzIHNlY3Rpb25zIHBhciBkZXMgbWFycXVldXJzIHRlbXBvcmFpcmVzXG5cdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZShodG1sUmVnZXgsICdIVE1MX1BMQUNFSE9MREVSJyk7XG5cdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZSh5YW1sUmVnZXgsICdZQU1MX1BMQUNFSE9MREVSJyk7XG5cdFxuXHRcdC8vIEFwcGxpcXVlciBsZXMgclx1MDBFOGdsZXMgZCdlc3BhY2VtZW50XG5cdFx0bGV0IHJlZ2V4ID0gLyguKShbOjs/IVx1MDBCQl0pL2c7XG5cdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZShyZWdleCwgKG1hdGNoLCBwMSwgcDIpID0+IHtcblx0XHRcdGlmIChwMSA9PT0gJyAnIHx8IHAxID09PSAnXFx1MDBBMCcpIHtcblx0XHRcdFx0cmV0dXJuICdcXHUwMEEwJyArIHAyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHAxICsgJ1xcdTAwQTAnICsgcDI7XG5cdFx0fSk7XG5cdFxuXHRcdHJlZ2V4ID0gLyhbXHUwMEFCXHUyMDE0XSkoLik/L2c7XG5cdFx0Y29udGVudCA9IGNvbnRlbnQucmVwbGFjZShyZWdleCwgKG1hdGNoLCBwMSwgcDIpID0+IHtcblx0XHRcdGlmIChwMiA9PT0gJyAnIHx8IHAyID09PSAnXFx1MDBBMCcpIHtcblx0XHRcdFx0cmV0dXJuIHAxICsgJ1xcdTAwQTAnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHAxICsgJ1xcdTAwQTAnICsgcDI7XG5cdFx0fSk7XG5cdFxuXHRcdC8vIFJcdTAwRTlpbnRcdTAwRTlncmVyIGxlcyBzZWN0aW9ucyBIVE1MIGV0IFlBTUxcblx0XHRodG1sTWF0Y2hlcy5mb3JFYWNoKHBsYWNlaG9sZGVyID0+IHtcblx0XHRcdGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoJ0hUTUxfUExBQ0VIT0xERVInLCBwbGFjZWhvbGRlcik7XG5cdFx0fSk7XG5cdFx0eWFtbE1hdGNoZXMuZm9yRWFjaChwbGFjZWhvbGRlciA9PiB7XG5cdFx0XHRjb250ZW50ID0gY29udGVudC5yZXBsYWNlKCdZQU1MX1BMQUNFSE9MREVSJywgcGxhY2Vob2xkZXIpO1xuXHRcdH0pO1xuXHRcblx0XHRyZXR1cm4gY29udGVudDtcblx0fVxuXG5cdGFwb3N0cm9waGVzKGNvbnRlbnQ6IHN0cmluZykge1xuXHRcdC8vIEV4dHJhaXJlIGxlcyBzZWN0aW9ucyBIVE1MIGV0IFlBTUxcblx0XHRjb25zdCBodG1sUmVnZXggPSAvPFtePl0qPi9nO1xuXHRcdGNvbnN0IHlhbWxSZWdleCA9IC8tLS1bXFxzXFxTXSs/LS0tL2c7XG5cdFxuXHRcdGxldCBodG1sTWF0Y2hlcyA9IGNvbnRlbnQubWF0Y2goaHRtbFJlZ2V4KSB8fCBbXTtcblx0XHRsZXQgeWFtbE1hdGNoZXMgPSBjb250ZW50Lm1hdGNoKHlhbWxSZWdleCkgfHwgW107XG5cdFxuXHRcdC8vIFJlbXBsYWNlciBjZXMgc2VjdGlvbnMgcGFyIGRlcyBtYXJxdWV1cnMgdGVtcG9yYWlyZXNcblx0XHRjb250ZW50ID0gY29udGVudC5yZXBsYWNlKGh0bWxSZWdleCwgJ0hUTUxfUExBQ0VIT0xERVInKTtcblx0XHRjb250ZW50ID0gY29udGVudC5yZXBsYWNlKHlhbWxSZWdleCwgJ1lBTUxfUExBQ0VIT0xERVInKTtcblxuXHRcdGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoLycvZywgXCJcdTIwMTlcIik7XG5cdFxuXHRcdC8vIFJcdTAwRTlpbnRcdTAwRTlncmVyIGxlcyBzZWN0aW9ucyBIVE1MIGV0IFlBTUxcblx0XHRodG1sTWF0Y2hlcy5mb3JFYWNoKHBsYWNlaG9sZGVyID0+IHtcblx0XHRcdGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoJ0hUTUxfUExBQ0VIT0xERVInLCBwbGFjZWhvbGRlcik7XG5cdFx0fSk7XG5cdFx0eWFtbE1hdGNoZXMuZm9yRWFjaChwbGFjZWhvbGRlciA9PiB7XG5cdFx0XHRjb250ZW50ID0gY29udGVudC5yZXBsYWNlKCdZQU1MX1BMQUNFSE9MREVSJywgcGxhY2Vob2xkZXIpO1xuXHRcdH0pO1xuXHRcblx0XHRyZXR1cm4gY29udGVudDtcblx0fVxuXG5cdHBvZW0oY29udGVudDpzdHJpbmcpIHtcblx0XHRcdGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1x1MjBBQ1x1MjBBQyguKj8pXHUyMEFDXHUyMEFDL2dzLCAobWF0Y2gsIHBvZW0pID0+IHtcblx0XHRcdGxldCBwYXJhZ3JhcGhzID0gcG9lbS5zcGxpdCgnXFxuXFxuJyk7XG5cdFx0XG5cdFx0XHRpZiAocGFyYWdyYXBocy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIGA8ZGl2IGN1c3RvbS1zdHlsZT1cInBvZW0tc29sb1wiIGNsYXNzPVwicG9lbS1zb2xvXCI+JHtwYXJhZ3JhcGhzWzBdfTwvZGl2PlxcbmA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBBcHBsaXF1ZXIgZGVzIHN0eWxlcyBkaWZmXHUwMEU5cmVudHMgYXUgcHJlbWllciwgZGVybmllciBldCBhdXggcGFyYWdyYXBoZXMgaW50ZXJtXHUwMEU5ZGlhaXJlc1xuXHRcdFx0XHRsZXQgZm9ybWF0dGVkUG9lbSA9IHBhcmFncmFwaHMubWFwKChwLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpbmRleCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGA8ZGl2IGN1c3RvbS1zdHlsZT1cInBvZW0tdG9wXCIgY2xhc3M9XCJwb2VtLXRvcFwiPiR7cH08L2Rpdj5cXG5gO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaW5kZXggPT09IHBhcmFncmFwaHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGA8ZGl2IGN1c3RvbS1zdHlsZT1cInBvZW0tYm90dG9tXCIgY2xhc3M9XCJwb2VtLWJvdHRvbVwiPiR7cH08L2Rpdj5gO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYDxkaXYgY3VzdG9tLXN0eWxlPVwicG9lbVwiIGNsYXNzPVwicG9lbVwiPiR7cH08L2Rpdj5cXG5gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkuam9pbignXFxuJyk7XG5cdFx0XG5cdFx0XHRcdHJldHVybiBmb3JtYXR0ZWRQb2VtO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBjb250ZW50O1xuXHR9XG5cblx0YXN5bmMgZHVwbGljYXRlRm9sZGVyKGZvbGRlclBhdGg6c3RyaW5nKSB7XG5cblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHR9XG5cblx0b251bmxvYWQoKSB7XG5cdH1cblxufVxuXG5jbGFzcyBGb2xkZXJGdXNpb25TZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogRm9sZGVyRnVzaW9uO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IEZvbGRlckZ1c2lvbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3Qge2NvbnRhaW5lckVsfSA9IHRoaXM7XG5cblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXG5cdFx0Y29uc3QgdGl0bGVFbCA9IGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0ZvbGRlciBGdXNpb24gc2V0dGluZ3MnIH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnU21hbGwgY2FwcycpXG5cdFx0XHQuc2V0RGVzYygnQ29udmVydCAtLXRleHQtLSBpbnRvIFBhbmRvYyBIVE1MIHNtYWxsIGNhcHMnKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFsbGNhcHMpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zbWFsbGNhcHMgPSB2YWx1ZTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0LnNldE5hbWUoJ0FwcGx5IHJpZ2h0IHN0eWxlJylcblx0XHQuc2V0RGVzYygnQ29udmVydCBAQHBhcmFncmFwaCBpbnRvIFBhbmRvYyBIVE1MIGFsaWduIHJpZ2h0Jylcblx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcblx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yaWdodClcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MucmlnaHQgPSB2YWx1ZTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHQuc2V0TmFtZSgnQXBwbHlzIHRvcC1wYXJhIHN0eWxlJylcblx0XHQuc2V0RGVzYygnQ29udmVydCBcdTAwQTNcdTAwQTNwYXJhZ3JhcGggaW50byBQYW5kb2MgRG9jeCB0b3AtcGFyYScpXG5cdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudG9wcGFyYSlcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudG9wcGFyYSA9IHZhbHVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdBcHBseXMgcG9lbSBzdHlsZScpXG5cdFx0LnNldERlc2MoJ0NvbnZlcnQgXHUyMEFDXHUyMEFDcGFyYWdyYXBoIGludG8gUGFuZG9jIERvY3ggcG9lbScpXG5cdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucG9lbSlcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MucG9lbSA9IHZhbHVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdOZXcgcGFnZScpXG5cdFx0LnNldERlc2MoJ0NvbnZlcnQgXFxcXG5ld3BhZ2UgaW50byB3b3JkIHN0eXBlIHBhZ2UtYnJlYWsnKVxuXHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5ld3BhZ2UpXG5cdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLm5ld3BhZ2UgPSB2YWx1ZTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHQuc2V0TmFtZSgnTm8gSFRNTCBjb21tZW50cycpXG5cdFx0LnNldERlc2MoJ1JlbW92ZSBhbGwgPCEtLSB0ZXh0IC0tPicpXG5cdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mubm9jb21tZW50cylcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mubm9jb21tZW50cyA9IHZhbHVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdObyBNYXJrZG93biBjb21tZW50cycpXG5cdFx0LnNldERlc2MoJ1JlbW92ZSBhbGwgJSV0ZXh0JSUnKVxuXHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5vTURjb21tZW50cylcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mubm9NRGNvbW1lbnRzID0gdmFsdWU7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0fSkpO1xuXG5cdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdUeXBvZ3JhcGhpYyBhcG9zdHRyb3BoZXMnKVxuXHRcdC5zZXREZXNjKCdSZXBsYWNlIFxcJyB3aXRoIFx1MjAxOScpXG5cdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBvc3Ryb3BoZSlcblx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXBvc3Ryb3BoZSA9IHZhbHVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdGcmVuY2ggaGFyZCBzcGFjZXMnKVxuXHRcdC5zZXREZXNjKCdBZGRhcHQgaGFyZCBzcGFjZXMgYmVmb3JlIGRvdWJsZSBwb25jdHVhdGlvbnMnKVxuXHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmhhcmRzcGFjZXMpXG5cdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmhhcmRzcGFjZXMgPSB2YWx1ZTtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHR9KSk7XG5cdFxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdC5zZXROYW1lKCdFeGNsdWRlJylcblx0XHQuc2V0RGVzYygnUmVnZXggdG8gZXhjbHVkZSBmaWxlcyBhbmQgZm9sZGVycy4nKVxuXHRcdC5hZGRUZXh0KHRleHQgPT4gdGV4dFxuXHRcdFx0LnNldFBsYWNlaG9sZGVyKCdFbnRlciB5b3VyIGZpbGVzIGFuZCBmb2xkZXJzJylcblx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5leGNsdWRlKVxuXHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5leGNsdWRlID0gdmFsdWU7XG5cdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0fSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnTm90ZSBzZXBhcmF0b3InKVxuXHRcdFx0LnNldERlc2MoJ1lvdSBjYW4gdXNlIExhdGV4IFxcXFxuZXdwYWdlIGZvciBleGFtcGxlLicpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHRleHRcblx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCdFbnRlciB5b3VyIHNlcGFyYXRvcicpXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5ub3RlU2VwYXJhdG9yKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Mubm90ZVNlcGFyYXRvciA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBZ0U7QUFrQmhFLElBQU0sbUJBQXlDO0FBQUEsRUFDOUMsZUFBZTtBQUFBLEVBQ2YsU0FBUztBQUFBLEVBQ1QsV0FBVztBQUFBLEVBQ1gsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLEVBQ1QsU0FBUztBQUFBLEVBQ1QsTUFBTTtBQUFBLEVBQ04sWUFBWTtBQUFBLEVBQ1osWUFBWTtBQUFBLEVBQ1osY0FBYztBQUFBLEVBQ2QsWUFBWTtBQUNiO0FBRUEsSUFBcUIsZUFBckIsY0FBMEMsdUJBQU87QUFBQSxFQUdoRCxNQUFNLFNBQVM7QUFDZCxVQUFNLEtBQUssYUFBYTtBQUd4QixTQUFLLGNBQWMsSUFBSSx1QkFBdUIsS0FBSyxLQUFLLElBQUksQ0FBQztBQUU3RCxTQUFLLGNBQWMsS0FBSyxJQUFJLFVBQVUsR0FBRyxhQUFhLENBQUMsTUFBTSxTQUFTO0FBRXJFLFVBQUksZ0JBQWdCLHlCQUFTO0FBRTVCLGFBQUssUUFBUSxDQUFDLFNBQVM7QUFDdEIsZUFBSyxTQUFTLGVBQWUsRUFDekIsUUFBUSxNQUFNO0FBRWQsaUJBQUssYUFBYSxLQUFLLElBQUk7QUFBQSxVQUM1QixDQUFDO0FBQUEsUUFDTCxDQUFDO0FBQUEsTUFTRjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBTSxhQUFhLFlBQWtCO0FBQ3BDLFNBQUssaUJBQWlCLFVBQVUsRUFBRSxLQUFLLFlBQVU7QUFDaEQsV0FBSyxZQUFZLFlBQVcsTUFBTTtBQUFBLElBQ25DLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLGlCQUFpQixZQUFxQztBQUUzRCxVQUFNLGtCQUFrQjtBQUN4QixVQUFNLGVBQWUsSUFBSSxPQUFPLEtBQUssU0FBUyxPQUFPO0FB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SyxPQUFPLFNBQVMsYUFBYTtBQUNsQyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBRUgsUUFBSSx3QkFBUSxXQUFXLEVBQ3RCLFFBQVEsc0JBQXNCLEVBQzlCLFFBQVEscUJBQXFCLEVBQzdCLFVBQVUsWUFBVSxPQUNuQixTQUFTLEtBQUssT0FBTyxTQUFTLFlBQVksRUFDMUMsU0FBUyxPQUFPLFVBQVU7QUFDMUIsV0FBSyxPQUFPLFNBQVMsZUFBZTtBQUNwQyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBR0gsUUFBSSx3QkFBUSxXQUFXLEVBQ3RCLFFBQVEsMEJBQTBCLEVBQ2xDLFFBQVEsdUJBQW1CLEVBQzNCLFVBQVUsWUFBVSxPQUNuQixTQUFTLEtBQUssT0FBTyxTQUFTLFVBQVUsRUFDeEMsU0FBUyxPQUFPLFVBQVU7QUFDMUIsV0FBSyxPQUFPLFNBQVMsYUFBYTtBQUNsQyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBRUgsUUFBSSx3QkFBUSxXQUFXLEVBQ3RCLFFBQVEsb0JBQW9CLEVBQzVCLFFBQVEsK0NBQStDLEVBQ3ZELFVBQVUsWUFBVSxPQUNuQixTQUFTLEtBQUssT0FBTyxTQUFTLFVBQVUsRUFDeEMsU0FBUyxPQUFPLFVBQVU7QUFDMUIsV0FBSyxPQUFPLFNBQVMsYUFBYTtBQUNsQyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBRUgsUUFBSSx3QkFBUSxXQUFXLEVBQ3RCLFFBQVEsU0FBUyxFQUNqQixRQUFRLHFDQUFxQyxFQUM3QyxRQUFRLFVBQVEsS0FDZixlQUFlLDhCQUE4QixFQUM3QyxTQUFTLEtBQUssT0FBTyxTQUFTLE9BQU8sRUFDckMsU0FBUyxPQUFPLFVBQVU7QUFDMUIsV0FBSyxPQUFPLFNBQVMsVUFBVTtBQUMvQixZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBRUgsUUFBSSx3QkFBUSxXQUFXLEVBQ3JCLFFBQVEsZ0JBQWdCLEVBQ3hCLFFBQVEsMENBQTBDLEVBQ2xELFFBQVEsVUFBUSxLQUNmLGVBQWUsc0JBQXNCLEVBQ3JDLFNBQVMsS0FBSyxPQUFPLFNBQVMsYUFBYSxFQUMzQyxTQUFTLE9BQU8sVUFBVTtBQUMxQixXQUFLLE9BQU8sU0FBUyxnQkFBZ0I7QUFDckMsWUFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLElBQ2hDLENBQUMsQ0FBQztBQUFBLEVBQ0w7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
