import { chromium } from 'playwright';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8081';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function session(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.goto(APP);
  await page.getByText('CivicPass').first().waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: 'Sign in' }).first().click();
  await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Demo1234!');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await page.getByText(/(Good (morning|afternoon|evening)), Alex/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}redesign-home-${theme}.png` });

  // Navigate via the tab bar (SPA, no reload) so the demo session survives.
  await page.getByText('Documents', { exact: true }).last().click();
  await page.getByText("DRIVER'S LICENCE").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}redesign-wallet-${theme}.png` });

  await page.getByText('Tickets', { exact: true }).last().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}redesign-fines-${theme}.png` });

  // Open the first ticket to show the detail (POA court-status card lives here).
  await page.getByText(/Fail to stop|Speeding|red light/i).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}redesign-fine-${theme}.png`, fullPage: true });

  await ctx.close();
}

await session('light');
await session('dark');
await browser.close();
console.log('shots done');
