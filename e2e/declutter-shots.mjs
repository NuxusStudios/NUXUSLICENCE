import { chromium } from 'playwright';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8082';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const vis = (loc) => loc.filter({ visible: true });

async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.goto(APP);
  await page.getByText('CivicPass').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}declutter-welcome-${theme}.png`, fullPage: true });

  await page.getByRole('button', { name: 'Sign in' }).first().click();
  await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Demo1234!');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await page.getByText(/(Good (morning|afternoon|evening)), Alex/).waitFor({ timeout: 15000 });

  await vis(page.getByText('Tickets', { exact: true })).last().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}declutter-fines-${theme}.png`, fullPage: true });

  await ctx.close();
}

await run('light');
await browser.close();
console.log('declutter shots done');
