import { chromium } from 'playwright';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8082';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.goto(APP);
  await page.getByText('CivicPass').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1800); // let the lamp beam + rise-in animation settle
  await page.screenshot({ path: `${SHOTS}hero-${theme}.png` });
  await page.screenshot({ path: `${SHOTS}hero-full-${theme}.png`, fullPage: true });
  await ctx.close();
}

await run('light');
await run('dark');
await browser.close();
console.log('hero shots done');
