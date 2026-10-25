import { chromium } from 'playwright';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8082';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const vis = (loc) => loc.filter({ visible: true });

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
const page = await ctx.newPage();
await page.addInitScript(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.goto(APP);
await page.getByText('CivicPass').first().waitFor({ timeout: 30000 });
await page.getByRole('button', { name: 'Sign in' }).first().click();
await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Demo1234!');
await page.getByRole('button', { name: 'Sign in' }).last().click();
await page.getByText(/(Good (morning|afternoon|evening)), Alex/).waitFor({ timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}sanad-home.png` });

async function tab(name, file) {
  try {
    await vis(page.getByText(name, { exact: true })).last().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}${file}` });
    console.log('shot', file);
  } catch (e) {
    console.log('skip', name, String(e).split('\n')[0]);
  }
}

await tab('Wallet', 'sanad-wallet.png');
await tab('Documents', 'sanad-documents.png');
await tab('Services', 'sanad-services.png');
await tab('Account', 'sanad-account.png');

await ctx.close();
await browser.close();
console.log('sanad shots done');
