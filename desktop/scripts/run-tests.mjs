#!/usr/bin/env node
/**
 * Run vitest under Electron in Node mode (`ELECTRON_RUN_AS_NODE=1`).
 *
 * Why: `better-sqlite3` is compiled for the ELECTRON abi (`npm run rebuild`,
 * what the app itself loads). Plain-Node vitest needs the opposite ABI, which
 * used to force `npm rebuild better-sqlite3 --no-save` before every test run
 * and `npm run rebuild` after — and the swap fails with EBUSY whenever the
 * desktop app is open (it has the .node file loaded).
 *
 * Running the tests inside the Electron binary in Node mode makes the ABI
 * match by construction: no rebuilds in either direction, and tests can run
 * while the app is open (the .node is only loaded, never rewritten).
 *
 * Usage (same as vitest): `node scripts/run-tests.mjs [vitest args…]`
 *   e.g. `node scripts/run-tests.mjs run electron/project-file-db/test`
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Electron binary path from the electron package (throws if not installed).
const electronExe = require('electron');

const vitestEntry = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
if (!fs.existsSync(vitestEntry)) {
    console.error('run-tests: vitest entry not found at ' + vitestEntry);
    process.exit(1);
}

const child = spawn(electronExe, [vitestEntry, ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

child.on('error', (err) => {
    console.error('run-tests: failed to start Electron:', err.message);
    process.exit(1);
});
child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
    } else {
        process.exit(code ?? 0);
    }
});
