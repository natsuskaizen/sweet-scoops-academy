// Checks a deployed copy of the game: the page must be the built one (not the
// raw repo, which points at /src/main.ts) and every script and stylesheet it
// references must load. Retries while the Pages CDN catches up.
//
//   node scripts/check-live-site.mjs https://<user>.github.io/<repo>/
const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/check-live-site.mjs <url>');
  process.exit(2);
}

const ATTEMPTS = 12;
const DELAY_MS = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function problemsWith(pageUrl) {
  const res = await fetch(pageUrl, { cache: 'no-store' });
  if (!res.ok) return [`page returned ${res.status}`];
  const html = await res.text();
  if (html.includes('/src/main.ts')) return ['page is the unbuilt source (is Pages publishing from a branch?)'];
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], pageUrl).href);
  if (!assets.some((a) => a.endsWith('.js'))) return ['page references no script'];
  const missing = [];
  for (const asset of assets) {
    const r = await fetch(asset, { cache: 'no-store' });
    if (!r.ok) missing.push(`${asset} returned ${r.status}`);
  }
  return missing;
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const problems = await problemsWith(url).catch((err) => [String(err)]);
  if (problems.length === 0) {
    console.warn(`Live site OK: ${url}`);
    process.exit(0);
  }
  console.warn(`Attempt ${attempt}/${ATTEMPTS}: ${problems.join('; ')}`);
  if (attempt < ATTEMPTS) await sleep(DELAY_MS);
}
console.error(`Live site check failed for ${url}`);
process.exit(1);
