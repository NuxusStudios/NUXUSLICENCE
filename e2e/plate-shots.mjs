import { chromium } from 'playwright';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8081';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function run(theme) {
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

  const vis = (loc) => loc.filter({ visible: true });
  try {
    await vis(page.getByText('Account', { exact: true })).last().click();
    await page.waitForTimeout(500);
    await vis(page.getByText('Vehicles', { exact: true })).first().click();
    await page.waitForTimeout(800);
    await vis(page.getByText(/Honda Civic/i)).first().click();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${SHOTS}plate-vehicle-${theme}.png` });

    await vis(page.getByText(/personalized plates|order.*plates|Personalized/i)).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SHOTS}plate-order-${theme}.png` });
  } catch (e) {
    await page.screenshot({ path: `${SHOTS}plate-FAIL-${theme}.png` });
    console.log(`FAIL ${theme}: ${String(e).split('\n')[0]}`);
  }

  await ctx.close();
}

await run('light');
await run('dark');
await browser.close();
console.log('plate shots done');
