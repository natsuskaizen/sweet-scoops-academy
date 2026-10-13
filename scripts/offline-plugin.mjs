// Vite plugin: writes dist/sw.js from src/pwa/sw.js after each build, filling
// in every built file (so the game can start offline) and a version taken from
// their contents (so each deploy installs a fresh service worker and drops the
// old cache).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const TEMPLATE = new URL('../src/pwa/sw.js', import.meta.url);
const SKIP = [/^sw\.js$/, /\.md$/];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

/** Built files as URLs relative to the service worker; the page is cached under "./". */
export function precacheEntries(outDir) {
  return listFiles(outDir)
    .map((path) => relative(outDir, path).split(sep).join('/'))
    .filter((file) => !SKIP.some((re) => re.test(file)))
    .sort()
    .map((file) => (file === 'index.html' ? './' : file));
}

function buildVersion(outDir, entries) {
  const hash = createHash('sha256');
  for (const entry of entries)
    hash.update(entry).update(readFileSync(join(outDir, entry === './' ? 'index.html' : entry)));
  return hash.digest('hex').slice(0, 12);
}

/** Writes sw.js into a built folder. Also used by the redeploy e2e test on a doctored copy of dist. */
export function writeServiceWorker(outDir) {
  const entries = precacheEntries(outDir);
  const source = readFileSync(TEMPLATE, 'utf8')
    .replace('__BUILD_VERSION__', buildVersion(outDir, entries))
    .replace('__PRECACHE_FILES__', JSON.stringify(entries));
  writeFileSync(join(outDir, 'sw.js'), source);
}

export function offlinePlugin() {
  let outDir = 'dist';
  return {
    name: 'sweet-scoops-offline',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      writeServiceWorker(outDir);
    },
  };
}
