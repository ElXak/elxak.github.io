#!/usr/bin/env node
// Rebuilds dist/ — the folder wrangler.jsonc's assets.directory points at
// for `npx wrangler deploy` — from the repo's actual deployable files.
// There's no bundler here; this just copies the deployable subset of the
// repo root into dist/, deleting anything already in dist/ first so
// removed/renamed files don't linger. Run from anywhere; paths are resolved
// relative to this script's location (repo_root/tool/).
//
// Usage: node tool/build-dist.js

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(REPO_ROOT, 'dist');

// Root-level entries that are repo bookkeeping or infra, not deployable
// site content. Anything NOT in this set (and not dotfile/dotdir, see below)
// gets copied into dist/ as-is — new pages/assets added at the root are
// picked up automatically, no edits needed here.
const ROOT_EXCLUDE = new Set([
  'CLAUDE.md',
  'README.md',
  '_config.yaml', // Jekyll config for GitHub Pages, irrelevant to the Cloudflare deploy
  'wrangler.jsonc',
  'dist',
  'tool',
  'src', // Worker source (src/worker.js) — run via `main`, not a static asset
]);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const name of fs.readdirSync(REPO_ROOT)) {
  // Dotfiles/dotdirs are never deployable site content (.git, editor/tool
  // state like .qodo, etc.) — skip all of them by convention instead of
  // naming each one.
  if (name.startsWith('.')) continue;
  if (ROOT_EXCLUDE.has(name)) continue;
  fs.cpSync(path.join(REPO_ROOT, name), path.join(DIST, name), { recursive: true });
}

console.log('dist/ rebuilt from: ' + REPO_ROOT + ' (excluding: ' + [...ROOT_EXCLUDE].join(', ') + ')');
console.log('Run `npx wrangler deploy` next.');
