import assert from 'node:assert/strict';
import { accessSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('manifest.json', 'utf8'));
const tag = process.env.GITHUB_REF_NAME ?? version;

assert.ok(/^\d+\.\d+\.\d+$/.test(tag) && tag === version,
	'Release tag must match manifest version (X.Y.Z, without a v prefix)');

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	accessSync(file);
}

console.log(tag);
