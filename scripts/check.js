import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const required = ['README.md', 'public/index.html', 'public/app.js', 'public/styles.css', 'core/csv.js', 'core/scoring.js', 'core/proposals.js', 'core/export.js', 'docs/account-parity-matrix.md', 'scripts/build-calibration-sample.js', 'scripts/evaluate-calibration.js'];
const forbidden = /(SF_ACCESS_TOKEN|sf org display|salesforce-report-latest|OneDrive-POLITICO|(?:^|[\\/])\.env(?:[\\/]|$))/i;
for (const relative of required) await readFile(join(root, relative));
const files = [];
async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { if (entry.name === 'node_modules' || entry.name === '.git') continue; const path = join(dir, entry.name); if (entry.isDirectory()) await walk(path); else files.push(path); } }
await walk(root);
for (const path of files) { const text = await readFile(path, 'utf8'); if (forbidden.test(text) && !path.endsWith('check.js')) throw new Error(`Public-repository hygiene failure in ${path}`); }
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) throw new Error(`Node.js 20+ required; found ${process.versions.node}.`);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tests = spawnSync(npmCommand, ['test'], { cwd: root, encoding: 'utf8' });
if (tests.status !== 0) throw new Error(tests.stdout + tests.stderr);
console.log(`Structural and public-hygiene checks passed for ${files.length} files.`);
