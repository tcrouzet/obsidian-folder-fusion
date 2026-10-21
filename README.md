# Folder Fusion

**Write chapter by chapter. Read the whole book.**

Your novel, essay or long-form project lives in separate Obsidian notes. Folder Fusion brings those notes together: right-click a folder, choose **Folder fusion**, and get one manuscript to read, archive or export.

[Download the latest release](https://github.com/tcrouzet/obsidian-folder-fusion/releases/latest) · [Report an issue](https://github.com/tcrouzet/obsidian-folder-fusion/issues)

## From a folder to a manuscript

```text
My novel/
├── 01-Opening.md
├── 02-The journey/
│   ├── 01-Departure.md
│   └── 02-Arrival.md
└── 03-Ending.md
           ↓ Folder fusion
    fusion-My novel-20261020-1430.md
```

Folder Fusion looks up the selected folder and walks its children and subfolders, without enumerating all files in the vault. It sorts those files by their full paths and combines their contents. Numeric prefixes help put chapters and sections in the intended order. The generated note sits directly inside the selected folder; source notes stay in place.

- **Read a complete draft** without switching between chapters.
- **Keep dated snapshots** of your work. Generated fusion files are excluded from later compilations.
- **Clean the manuscript** by removing comments and crossed-out text from the output.
- **Prepare an export** with optional small caps, alignment, poetry and page-break markup for Pandoc.
- **Gather numeric footnotes** at the end of the manuscript.

## Install Folder Fusion

Requires **Obsidian 1.5.0 or later**. The manifest allows desktop and mobile use; the manual installation steps below describe desktop installation.

1. Open the [latest GitHub release](https://github.com/tcrouzet/obsidian-folder-fusion/releases/latest).
2. Download `main.js`, `manifest.json` and `styles.css` from the release assets.
3. Inside your vault, create `.obsidian/plugins/folder-fusion/` and put those files there.
4. Restart Obsidian and enable **Folder Fusion** under **Settings → Community plugins**.

On macOS, press `Cmd+Shift+.` in Finder to show hidden folders. If your vault uses a custom configuration folder, use that folder in place of `.obsidian`.

To update, close Obsidian and replace the three plugin files with those from the new release. Keep `data.json`, which stores your settings.

## Compile your project

1. Arrange your chapters in a folder, using names such as `01-Opening.md` and `02-Chapter.md` to control their order.
2. Adjust the options in **Settings → Folder Fusion → Fusion**.
3. Right-click the project folder in Obsidian's file explorer and choose **Folder fusion**.
4. Open the generated `fusion-<folder>-YYYYMMDD-HHMM.md` note inside that folder.

The timestamp uses **UTC**. Compiling the same folder twice in the same minute replaces that minute's snapshot. Compile in a later minute to keep another snapshot.

The result is a Markdown note. To produce formats such as DOCX or PDF, use your usual export workflow, for example a Pandoc plugin such as [Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export).

## Number a folder

Right-click a folder and choose **Folder numbering** to give its files a consistent numeric prefix. The command applies immediately, in natural name order (`2` before `10`). It works on direct children only: the selected folder itself and the contents of its subfolders are not numbered.

Configure numbering in **Settings → Folder Fusion → Numbering**:

| Setting | Default | Effect |
| --- | --- | --- |
| **Numbering start** | `1` | First number to assign. Names already beginning with a smaller number remain unchanged. Zero is allowed. |
| **Increment** | `1` | Step between consecutive numbers. Must be a positive whole number. Larger steps leave free numbers for inserting chapters. |
| **Numbering separator** | `-` | Text between the number and the name, for example ` - `. It must not start with a digit. Empty is allowed unless it would merge the prefix with a numeric title. |
| **Add folder name** | Off | Inserts the selected folder name between the number and the existing name, using the configured separator. When enabled, unnumbering also removes this folder prefix. |
| **Number folders** | Off | Includes direct subfolders in the same numbering sequence as files. Their children keep their names. |

The shared **Exclude** filters apply to numbering; generated snapshots are also skipped. A leading number is replaced rather than added again. The configured separator and common existing separators (spaces, dots, underscores, colons and hyphens) are removed after the old number. File extensions are preserved. For example, with the default settings, `01 - Opening.md`, `2.Journey.md` and `10 Ending.md` become `1-Opening.md`, `2-Journey.md` and `3-Ending.md`.

**Add folder name** turns `Opening.md` inside `Roman` into `1-Roman-Opening.md` with the default settings, or `01-Roman-Opening.md` when the largest number requires two digits. Running numbering again does not repeat the folder prefix. With **Number folders** enabled, the same prefix is added to direct subfolder names. Turning the option off stops adding the prefix to new names and preserves existing names.

There is no prefix-length setting. Width depends only on the largest assigned number, including the configured start and increment: nine files starting at one use `1` through `9`; ten use `01` through `10`; a hundred use `001` through `100`. Ten files starting at `0` use `0` through `9`; a hundred starting at `0` use `00` through `99`. Five files starting at `97` use `097` through `101` to keep sorting consistent. Excluded items, folders with **Number folders** off, and existing prefixes below the start do not consume a number.

### Leave room to insert chapters

**Set Increment above 1 to insert new chapters between existing ones without renumbering the whole folder.** For example, with three chapters, set **Numbering start** to `10` and **Increment** to `10`: they receive `10`, `20`, `30`. You can then manually name an inserted chapter `15-New chapter.md` to place it between `10-Opening.md` and `20-Journey.md`. Fusion sorts by filename, so the inserted chapter appears between them. Running **Folder numbering** again reapplies the configured spacing to all eligible items.

With the default **Increment** of `1`, numbering remains consecutive. With three chapters, **Numbering start** at `1` and **Increment** at `10`, the sequence is `01`, `11`, `21`; padding follows the largest assigned number. Excluded and protected items do not consume a step. Increment does not change which prefixes **Folder unnumbering** removes: all eligible prefixes at or above **Numbering start** are removed.

Renames use Obsidian's `fileManager.renameFile()` API, so Obsidian handles link updates according to your vault settings. This can update references elsewhere in the vault; the plugin's numbering code lists and renames only children of the selected folder. It does not read file contents or enumerate the vault.

The plugin checks naming collisions before starting, uses temporary names in the same folder when destinations overlap, and attempts to restore original names if a rename fails. If restoration also fails, the error lists the remaining names and their original paths. A second numbering operation is blocked while one is running.

At the bottom of the settings tab, enable the **Debug** toggle to reveal **Folder unnumbering** in folder context menus. This preference is saved and remains active after restarting Obsidian. It removes leading numbers and their separators from direct children. With **Add folder name** enabled, it also removes the matching folder prefix: `01-Roman-Opening.md` becomes `Opening.md`. With the option off, only the numeric prefix is removed. It preserves extensions, respects the shared exclusions and **Number folders** option, and leaves unnumbered names unchanged. Prefixes below **Numbering start** remain unchanged, just as with numbering; prefixes at or above it are removed. Naming collisions and names consisting only of numbers stop the operation before any rename. Turn **Debug** off to hide the command again.

## Exclude files and folders

Open **Settings → Folder Fusion → Exclude**. These filters apply to both **Fusion** and **Numbering**. Excluded folders and their contents are skipped.

| Setting | Default | Effect |
| --- | --- | --- |
| **Exclude characters** | `_` | Ignores any file or folder whose name contains any of the supplied characters, anywhere in the name. Characters are literal, including spaces. |
| **Exclude files/folders** | `sortspec` | Comma-separated full names, matched case-insensitively. Files can be listed with or without their extension: `sortspec` excludes `sortspec.md`; `Notes.md` excludes that filename but keeps `Notes.txt`. Folder names match exactly. |

For example, `_` skips `Draft_notes.md` and `Working_files`, while `sortspec, Research` skips those exact names, including `sortspec.md` and the contents of a folder named `Research`. It keeps `Research notes.md`. Clear both fields to disable the configurable exclusions; generated fusion snapshots remain excluded automatically.

The default `sortspec` name protects the configuration notes used by [Custom Sort](https://community.obsidian.md/plugins/custom-sort).

## Choose what goes into the manuscript

Open **Settings → Folder Fusion → Fusion** to configure the manuscript. On Obsidian 1.13 or later, these options also appear in settings search. Earlier supported versions retain the same controls in the plugin's settings tab.

| Setting | Default | Effect on the output |
| --- | --- | --- |
| **Note separator** | Empty | Appends the supplied text after each file, following two line breaks, including after the last file. |
| **No HTML comments** | On | Removes `<!-- comments -->`, including comments spanning several lines. |
| **No Markdown comments and strikethrough** | On | Removes both `%%comments%%` and `~~crossed-out text~~`, including their contents. |

Comment removal affects the generated manuscript. Your original notes retain their comments and crossed-out text.

## Prepare literary formatting for export

These options are **off by default**. Enable the styles you use in **Settings → Folder Fusion → Fusion**.

| Setting | Write in your notes | Generated markup |
| --- | --- | --- |
| **Small caps** | `--text--` | An HTML span with `font-variant:small-caps`. |
| **Apply right style** | `@@A paragraph` | A right-aligned div with the Pandoc custom style `Right`. |
| **Applys top-para style** | `££An opening paragraph` | A justified div with the custom style `top-para`. |
| **Applys poem style** | `€€A poem€€` | Divs using `poem-solo`, or `poem-top`, `poem` and `poem-bottom` for multiple stanzas separated by blank lines. |
| **New page** | `\newpage` | A div with the custom style `page-break` and a CSS page break. |

The setting names above match the plugin interface. Pandoc custom styles need corresponding styles in your DOCX reference document. Folder Fusion supplies the markup; the exporter and reference document determine the final layout. `styles.css` does not define these literary styles for Obsidian's preview.

## Footnotes and input limits

Folder Fusion renumbers numeric calls such as `[^1]` in their order of appearance and moves numeric definitions to the end. This handles the simple case where each chapter starts numbering at one, each note has one call, and definitions follow the same order as the calls.

Before compiling a large project, check these limits:

- **Use a folder containing text files.** The current scanner reads every matching file, including attachments; it does not filter by `.md`. Exclude non-text files or keep attachments outside the project folder.
- **Review complex footnotes.** Named footnotes, multiline definitions and repeated references to the same note are not handled as a complete Markdown footnote system.
- **Check embedded content after export.** The plugin concatenates file contents; it does not resolve embeds or rewrite relative links and attachment paths.

## Develop and test

Use **Node.js 22 or later** and npm. Run these commands from the repository root:

```bash
npm ci
npm test
npm run build
```

`npm test` runs the Node.js test runner with the installed esbuild dependency. It checks compilation order, exclusions, comment removal, optional formatting, footnotes, snapshot paths and release validation. No additional test framework is required.

`npm run build` checks TypeScript and produces the Obsidian entry point `main.js` at the repository root. For development, use:

```bash
npm run dev
```

This watches the source and rebuilds `main.js` with an inline source map. Stop it with `Ctrl+C`. Test in a development vault by placing this repository in its plugins directory and enabling Folder Fusion; reload the plugin after a rebuild.

```text
plugin/
└── main.ts                 Plugin, settings and manuscript transformations
scripts/
├── build.mjs               Development watcher and production build
├── test.mjs                Behavior and release tests
└── version-bump.mjs        Manifest and compatibility-map updates
release.sh                 Increment the patch version, commit, push and tag
.github/workflows/
└── release.yml             Publication when a version tag is pushed
```

Obsidian's installable files stay at the root: generated `main.js`, `manifest.json` and `styles.css`. TypeScript configuration, npm manifests and `versions.json` also stay at the root.

## Publish a release

Run [release.sh](release.sh) from the repository root, with Bash, jq, npm, an authenticated GitHub CLI and Git access to the repository. GitHub CLI identifies the repository and its default branch from the Git remote:

```bash
./release.sh
```

The script runs on the repository's default branch and performs the release sequence:

1. Install locked dependencies, check TypeScript, run lint and behavior tests, then build the plugin.
2. Commit local changes if needed, push the default branch and require a clean working tree.
3. Increment the patch version from `manifest.json`: `1.0.3` becomes `1.0.4`, then `1.0.5` on the next run. Synchronize `package.json`, `package-lock.json`, `manifest.json` and `versions.json` using npm and jq.
4. Commit and push the version update, then compare the complete manifest published on GitHub with the local manifest. Stop if they differ.
5. Create and push the matching version tag, without a `v` prefix, to trigger GitHub Actions.

`npm run release` runs the same script. **Both commands commit and push all local changes and start publication.** Review your working tree first. A failed test or build stops before the version changes; a failed Git command stops the sequence immediately. If publication stops after a commit or push, inspect the reported failure and repository state before retrying.

The single [release workflow](.github/workflows/release.yml) runs when a version tag is pushed. Branch pushes and pull requests do not start a workflow. It checks out the tag, installs locked dependencies, validates versions, runs lint and behavior tests, and builds the plugin using Node.js 26.12.0.

The workflow retains the tag's version and requires both `manifest.json` and `package.json` to match it. It attests the build provenance of `main.js`, `manifest.json` and `styles.css`, then publishes those files with GitHub CLI's `--verify-tag`. GitHub's automatic token grants the build job the permissions needed to publish the release and its attestations. GitHub CLI identifies the repository from the checkout's remote.

Check the **Release** run in GitHub Actions and the resulting release assets. Local tests exercise the release sequence with isolated Git and GitHub commands; publication itself must be verified on GitHub.

## Support the project

[Report a bug or suggest an improvement](https://github.com/tcrouzet/obsidian-folder-fusion/issues) with your Obsidian version, operating system and a small example of the folder structure or text involved.

Folder Fusion is an independent plugin by [Thierry Crouzet](https://tcrouzet.com), distributed under the [MIT license](LICENSE). If it helps you finish a manuscript, you can [support its development](https://www.paypal.com/donate/?business=MCZTJGYPGXXCW&no_recurring=0&currency_code=EUR).
