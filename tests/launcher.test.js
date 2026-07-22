import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('named regression: macOS launcher opens the ready local app', async () => {
  const launcher = await readFile(fileURLToPath(new URL('../Launch Cross-Currency Reviewer - Mac.command', import.meta.url)), 'utf8');
  assert.match(launcher, /curl -fsS/);
  assert.match(launcher, /open "\$url"/);
  assert.match(launcher, /wait "\$server_pid"/);
});
