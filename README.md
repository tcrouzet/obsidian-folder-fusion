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

Folder Fusion reads the selected folder and its subfolders, sorts files by their full paths, and combines their contents. Numeric prefixes help put chapters and sections in the intended order. The generated note sits directly inside the selected folder; source notes stay in place.

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
2. Adjust the options in **Settings → Folder Fusion**.
3. Right-click the project folder in Obsidian's file explorer and choose **Folder fusion**.
4. Open the generated `fusion-<folder>-YYYYMMDD-HHMM.md` note inside that folder.

The timestamp uses **UTC**. Compiling the same folder twice in the same minute replaces that minute's snapshot. Compile in a later minute to keep another snapshot.

The result is a Markdown note. To produce formats such as DOCX or PDF, use your usual export workflow, for example a Pandoc plugin such as [Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export).

## Choose what goes into the manuscript

| Setting | Default | Effect on the output |
| --- | --- | --- |
| **Exclude** | `sortspec\|_i` | Excludes files whose full paths match this case-insensitive regular expression. |
| **Note separator** | Empty | Appends the supplied text after each file, following two line breaks, including after the last file. |
| **No HTML comments** | On | Removes `<!-- comments -->`, including comments spanning several lines. |
| **No Markdown comments and strikethrough** | On | Removes both `%%comments%%` and `~~crossed-out text~~`, including their contents. |

For example, `sortspec|_i|Research|\.png$` excludes matching index notes, research paths and PNG files. Use a valid regular expression. To exclude nothing, use `(?!)`; an empty expression matches every path and produces an empty compilation.

Comment removal affects the generated manuscript. Your original notes retain their comments and crossed-out text.

## Prepare literary formatting for export

These options are **off by default**. Enable the styles you use in **Settings → Folder Fusion**.

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
- **Avoid sibling folders sharing the same prefix.** Selecting `Book` also matches paths beginning with `Book`, such as `Book-old`. Exclude those paths if needed.
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
├── check-release.mjs       Tag and artifact validation
├── publish-release.sh      Publish artifacts from the tagged CI checkout
└── version-bump.mjs        Manifest and compatibility-map updates
release.sh                 Increment the patch version, commit, push and tag
.github/workflows/
├── ci.yml                  Tests and build for branches and pull requests
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

The [CI workflow](.github/workflows/ci.yml) installs locked dependencies, runs tests, builds the plugin and checks the Bash scripts' syntax. The [release workflow](.github/workflows/release.yml) checks out the pushed tag, runs tests and a production build, then calls [scripts/publish-release.sh](scripts/publish-release.sh) to publish `main.js`, `manifest.json` and `styles.css` with generated release notes.

The CI publisher retains the tag's version. It rejects a tag that differs from `manifest.json`, checks that the installable files exist and requires the remote tag through GitHub CLI's `--verify-tag`. The workflow uses GitHub's automatic token with repository-content write permission for the release job. The target repository is configured in [commit.json](commit.json).

Check the **Release** run in GitHub Actions and the resulting release assets. Local tests exercise the release sequence with isolated Git and GitHub commands; publication itself must be verified on GitHub.

## Support the project

[Report a bug or suggest an improvement](https://github.com/tcrouzet/obsidian-folder-fusion/issues) with your Obsidian version, operating system and a small example of the folder structure or text involved.

Folder Fusion is an independent plugin by [Thierry Crouzet](https://tcrouzet.com), distributed under the [MIT license](LICENSE). If it helps you finish a manuscript, you can [support its development](https://www.paypal.com/donate/?business=MCZTJGYPGXXCW&no_recurring=0&currency_code=EUR).
