// Clicks through the single-file demo page (npm run build:demo-page) served inside a
// sandboxed iframe at a nested path, the strictest way it gets hosted. Start
// the harness first: node e2e/serve-demo-host.mjs apps/mobile/dist-demo/civicpass-demo.html

import { chromium } from 'playwright';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const errors = [];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

async function run(colorScheme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${colorScheme}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${colorScheme}] pageerror: ${e.message}`));
  await page.goto('http://localhost:8090/host');
  const app = page.frameLocator('#app');
  const text = (t, o) => app.getByText(t, o).filter({ visible: true }).first();
  const btn = (n) => app.getByRole('button', { name: n }).filter({ visible: true }).first();
  const shot = (n) => page.screenshot({ path: `${SHOTS}${colorScheme}-${n}.png` });
  // Tap the app's own header back button, as a person would.
  const back = async () => {
    await app.getByRole('link', { name: /back/i }).filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
  };
  return { page, app, text, btn, shot, ctx, back };
}

let current;
async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    await current?.screenshot({ path: `${SHOTS}FAIL-${name.replace(/\W+/g, '_').slice(0, 40)}.png` }).catch(() => {});
  }
}

const { app, text, btn, shot, page, back } = await run('light');
current = page;

await step('loads at a nested path inside a sandboxed frame (no storage)', async () => {
  await text('Create an account').waitFor({ timeout: 20000 });
  await text('Create an account').waitFor();
  await shot('01-welcome');
});
await step('icons render (Ionicons font inlined)', async () => {
  const ok = await page.frames()[1].evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.toLowerCase().includes('ionicons') && f.status === 'loaded');
  });
  if (!ok) throw new Error('ionicons font not loaded');
});
await step('sign in with prefilled demo account', async () => {
  await btn('Sign in').click();
  await app.getByRole('button', { name: 'Sign in' }).last().click();
  await text('Hello, Alex').waitFor({ timeout: 10000 });
  await shot('02-home');
});
await step('wallet → licence → QR', async () => {
  await app.getByRole('tab', { name: /Wallet/ }).click();
  // Tap the card's visible top strip; the rest is tucked under the next card in the stack.
  await app.getByRole('button', { name: "Driver's licence", exact: true }).filter({ visible: true }).first().click({ position: { x: 60, y: 22 } });
  await btn('Show QR to verify').click();
  await text('Code refreshes in').waitFor();
  await page.frames()[1].waitForFunction(() => [...document.querySelectorAll('svg path')].some((p) => (p.getAttribute('d') ?? '').length > 2000), null, { timeout: 10000 });
  await shot('03-qr');
  await app.getByRole('button', { name: /Done/ }).click();
  await back();
});
await step('simulate a red-light camera ticket and open it', async () => {
  await app.getByRole('tab', { name: /Tickets/ }).click();
  await btn('Simulate a red light camera ticket').click();
  await text('New camera ticket added for plate', { exact: false }).waitFor();
  await shot('04-simulated');
  await btn('View ticket').click();
  await text('Issued to the registered owner', { exact: false }).waitFor();
  await text('$390.00').waitFor();
  await shot('05-ticket');
});
await step('pay the ticket by card', async () => {
  await btn(/Pay now/).click();
  await app.getByLabel('Card number').fill('4242 4242 4242 4242');
  await btn('Pay by card').click();
  await text('Payment complete').waitFor();
  await btn('Done').click();
  await text('Receipt', { exact: false }).waitFor();
  await back();
});
await step('verifier screen rejects a bogus code', async () => {
  await app.getByRole('tab', { name: /Home/ }).click();
  await btn('Verify an ID').click();
  await app.getByLabel('Or paste a code').fill('demo.eyJmYWtlIjp0cnVlfQ.notarealseal000000000000000000000000000');
  await btn('Verify').click();
  await text('Not valid').waitFor();
  await shot('06-verify-bad');
  await back();
});
await step('lost phone: in-page confirmation then revoke', async () => {
  await app.getByRole('tab', { name: /Account/ }).click();
  await btn('Lost your phone? Revoke all QR codes').click();
  await app.getByRole('button', { name: 'Revoke all QR codes', exact: true }).filter({ visible: true }).first().click();
  await text('Wallet revoked.').waitFor();
  await shot('07-revoked');
});
await step('French', async () => {
  await btn('Français').click();
  await app.getByRole('tab', { name: /Accueil/ }).click();
  await text('Bonjour, Alex').waitFor();
  await shot('08-fr');
  await app.getByRole('tab', { name: /Compte/ }).click();
  await btn('English').click();
});
await step('sign out and register Sam', async () => {
  await btn('Sign out').click();
  await btn('Create an account').click();
  await app.getByLabel('Licence number').fill('L4321-09876-50302');
  await app.getByLabel('Date of birth (YYYY-MM-DD)').fill('1985-03-02');
  await btn('Continue').click();
  await btn('Scan licence card').click();
  await btn('Take selfie (liveness check)').click();
  await btn('Continue').click();
  await app.getByLabel('Email').fill('sam@example.com');
  await app.getByLabel('Password').fill('a-strong-passphrase');
  await btn('Create account').click();
  await text('Hello, Sam').waitFor({ timeout: 10000 });
});
await step('no horizontal overflow at phone width', async () => {
  const w = await page.frames()[1].evaluate(() => document.documentElement.scrollWidth);
  if (w > 391) throw new Error(`scrollWidth ${w}`);
});

const dark = await run('dark');
current = dark.page;
await step('dark theme renders', async () => {
  await dark.text('Create an account').waitFor({ timeout: 20000 });
  await dark.btn('Sign in').click();
  await dark.app.getByRole('button', { name: 'Sign in' }).last().click();
  await dark.text('Hello, Alex').waitFor({ timeout: 10000 });
  const bg = await dark.page.frames()[1].evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (bg !== 'rgb(12, 19, 27)') throw new Error(`body bg ${bg}`);
  await dark.shot('02-home');
});

await browser.close();
console.log(results.join('\n'));
console.log(`\nconsole errors (${errors.length}):\n${[...new Set(errors)].slice(0, 12).join('\n')}`);
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
