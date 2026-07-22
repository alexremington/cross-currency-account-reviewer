import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('named regression: macOS launcher opens the ready local app', async () => {
  const launcher = await readFile(fileURLToPath(new URL('../Launch Cross-Currency Reviewer - Mac.command', import.meta.url)), 'utf8');
  const runtime = await readFile(fileURLToPath(new URL('../scripts/launch-local-app.js', import.meta.url)), 'utf8');
  assert.match(launcher, /launch-local-app\.js/);
  assert.match(launcher, /--force-restart/);
  assert.match(runtime, /launchctl/);
  assert.match(runtime, /openUrl/);
  assert.match(runtime, /detached: true/);
  assert.match(runtime, /cross-currency-account-reviewer\/v1/);
});
