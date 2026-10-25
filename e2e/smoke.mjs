// End-to-end smoke test of the CivicPass web build. Drives the real app the way
// a user does and asserts each core surface renders. Exits non-zero on failure,
// so it can gate CI. Run against the served demo:
//   (serve dist-demo on :8082)  CHROMIUM_PATH=/opt/pw-browsers/chromium node e2e/smoke.mjs
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:8082';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const vis = (loc) => loc.filter({ visible: true });
let failures = 0;
const errors = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name} — ${String(e).split('\n')[0]}`);
  }
}

for (const theme of ['dark', 'light']) {
  console.log(`\n[${theme}]`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((t) => {
    try {
      document.documentElement?.setAttribute('data-theme', t);
    } catch {
      /* documentElement not ready on the very first init pass */
    }
  }, theme);
  await page.goto(APP);

  await check('landing renders', () => page.getByText('CivicPass').first().waitFor({ timeout: 30000 }));
  await check('sign in', async () => {
    await page.getByRole('button', { name: 'Sign in' }).first().click();
    await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
    await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Demo1234!');
    await page.getByRole('button', { name: 'Sign in' }).last().click();
    await page.getByText(/(Good (morning|afternoon|evening)), Alex/).waitFor({ timeout: 15000 });
  });
  await check('home shows the licence anchor', () => page.getByText(/Driver.s licence/).first().waitFor({ timeout: 8000 }));
  await check('documents tab lists a document', async () => {
    await vis(page.getByText('Documents', { exact: true })).last().click();
    await page.getByText(/Exp\./).first().waitFor({ timeout: 8000 });
  });
  await check('services tab shows categories', async () => {
    await vis(page.getByText('Services', { exact: true })).last().click();
    await page.getByText('Categories', { exact: true }).waitFor({ timeout: 8000 });
  });
  await check('account tab shows personal information', async () => {
    await vis(page.getByText('Account', { exact: true })).last().click();
    await page.getByText('Personal information', { exact: true }).waitFor({ timeout: 8000 });
  });
  await ctx.close();
}

await browser.close();
if (errors.length) {
  console.log(`\n${errors.length} console/page error(s):`);
  for (const e of errors.slice(0, 10)) console.log('  -', e);
}
if (failures || errors.length) {
  console.log(`\nSMOKE FAILED (${failures} assertion failure(s), ${errors.length} runtime error(s))`);
  process.exit(1);
}
console.log('\nSMOKE PASSED');
