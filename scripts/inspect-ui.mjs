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

const visit = async (url, label) => {
  console.log(`\n=== ${label} (${url}) ===`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch((e) => {
    console.log('goto error:', e.message);
  });
  await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
  const title = await page.title();
  const h1 = await page.locator('h1').allTextContents().catch(() => []);
  const buttons = await page.locator('button').allTextContents().catch(() => []);
  const links = await page.locator('a').evaluateAll((els) => els.map((a) => a.textContent?.trim() + ' -> ' + a.getAttribute('href'))).catch(() => []);
  console.log('title:', title);
  console.log('h1:', h1);
  console.log('buttons:', buttons.slice(0, 10));
  console.log('links:', links.slice(0, 15));
};

await visit('http://localhost:3000', 'home');
await visit('http://localhost:3000/login', 'login');
await visit('http://localhost:3000/register', 'register');

console.log('\n=== console / errors ===');
console.log(logs.join('\n') || '(none)');

await browser.close();
