import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve('scripts/.inspect');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.request().method()} ${r.url()}`);
});

const email = `inspect+${Date.now()}@local.test`;
const password = 'Password123!';

console.log(`Registering ${email}`);
await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
await page.locator('input#name, input[placeholder="Your name"]').first().fill('Inspector');
await page.locator('input[type=email]').fill(email);
await page.locator('input[type=password]').fill(password);
await Promise.all([
  page.waitForURL(/localhost:3000\/(?!register).*/, { timeout: 15000 }).catch(() => null),
  page.locator('button[type=submit]').click(),
]);
await page.waitForLoadState('networkidle').catch(() => null);
console.log('After register URL:', page.url());
await page.screenshot({ path: `${outDir}/post-register.png`, fullPage: true });

const visit = async (path, label) => {
  await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => console.log('goto', path, e.message));
  await page.screenshot({ path: `${outDir}/app-${label}.png`, fullPage: true });
  const headings = await page.locator('h1,h2').allTextContents().catch(() => []);
  console.log(`\n${path} -> URL=${page.url()}`);
  console.log('headings:', headings);
};

for (const [p, l] of [
  ['/', 'home'],
  ['/files', 'files'],
  ['/chats', 'chats'],
  ['/automations', 'automations'],
  ['/hosting', 'hosting'],
  ['/settings', 'settings'],
]) {
  await visit(p, l);
}

console.log('\n=== logs ===');
console.log(logs.join('\n') || '(none)');

await browser.close();
