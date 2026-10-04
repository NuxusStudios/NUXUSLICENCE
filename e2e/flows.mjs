import { chromium } from 'playwright';

const SHOTS = new URL('./shots/', import.meta.url).pathname;
const APP = 'http://localhost:8081';
const API = 'http://localhost:4000';
const results = [];
const consoleErrors = [];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

let lastToken;
page.on('response', async (r) => {
  if (r.url().includes('/presentations') && r.ok()) lastToken = (await r.json()).token;
});

async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: `${SHOTS}FAIL-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  }
}
const shot = (n) => page.screenshot({ path: `${SHOTS}${n}.png` });
const text = (t, opts) => page.getByText(t, opts).first();
const btn = (name) => page.getByRole('button', { name }).first();

await step('welcome screen', async () => {
  await page.goto(APP);
  await text('CivicPass').waitFor({ timeout: 20000 });
  await text('PROTOTYPE — not a valid government document').waitFor();
  await shot('01-welcome');
});

await step('sign in with demo account', async () => {
  await btn('Sign in').click();
  await page.getByLabel('Email').fill('demo@civicpass.example');
  await page.getByLabel('Password').fill('Demo1234!');
  await shot('02-sign-in');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await text('Hello, Alex').waitFor({ timeout: 10000 });
  await text('Open tickets').waitFor();
  await shot('03-home');
});

await step('wallet shows licence, health card, two vehicle permits', async () => {
  await page.getByRole('tab', { name: /Wallet/ }).click().catch(() => text('Wallet').click());
  await text("DRIVER'S LICENCE").waitFor();
  await text('HEALTH CARD').waitFor();
  const permits = await page.getByText('VEHICLE PERMIT').count();
  if (permits !== 2) throw new Error(`expected 2 vehicle permits, got ${permits}`);
  await shot('04-wallet');
});

await step('licence detail + QR presentation (full)', async () => {
  await text("DRIVER'S LICENCE").click();
  await btn('Show QR to verify').click();
  await text('Code refreshes in').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('svg path')].some((p) => (p.getAttribute('d') ?? '').length > 2000), null, { timeout: 10000 });
  if (!lastToken) throw new Error('no presentation token captured');
  await shot('05-licence-qr');
});

let fullToken;
await step('switch to age-only disclosure issues a new token', async () => {
  fullToken = lastToken;
  await text('Only that I am 19+').click();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(1500);
  if (lastToken === fullToken) throw new Error('token did not change');
  const claims = JSON.parse(Buffer.from(lastToken.split('.')[1], 'base64url').toString()).claims;
  if (JSON.stringify(claims) !== JSON.stringify({ ageOver19: true, photo: true })) throw new Error(`unexpected claims ${JSON.stringify(claims)}`);
  await shot('06-age-only-qr');
});

await step('verifier mode validates the full token and logs it', async () => {
  await page.goto(`${APP}/verify`);
  await page.getByLabel('Your organization (shown to the holder)').fill('Example Police Service');
  await page.getByLabel('Or paste a code').fill(fullToken);
  await btn('Verify').click();
  await text('Verified').waitFor();
  await text('Tremblay').waitFor();
  await shot('07-verify-valid');
});

await step('verifier rejects a tampered token', async () => {
  const [h, p, s] = fullToken.split('.');
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
  forged.claims.surname = 'Impostor';
  await page.getByLabel('Or paste a code').fill(`${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`);
  await btn('Verify').click();
  await text('Not valid').waitFor();
  await text('bad_signature').waitFor();
  await shot('08-verify-tampered');
});

await step('access log shows the police check', async () => {
  await page.goto(`${APP}/access-log`);
  await text('Example Police Service').waitFor();
  await shot('09-access-log');
});

await step('camera event from the processing centre lands on the owner account', async () => {
  const res = await fetch(`${API}/v1/integrations/camera-events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'dev-camera-integration-key' },
    body: JSON.stringify({
      eventId: `E2E-${Date.now()}`,
      type: 'red_light',
      plate: 'CVPS123',
      jurisdiction: 'ON',
      capturedAt: new Date(Date.now() - 3600_000).toISOString(),
      location: 'Demo Rd & Test Ave (eastbound)',
      municipality: 'Toronto',
      images: ['evidence://e2e-1.jpg', 'evidence://e2e-2.jpg'],
      secondsIntoRed: 2.1,
      setFine: 325,
    }),
  });
  const body = await res.json();
  if (body.results[0].deliveredVia !== 'app') throw new Error(JSON.stringify(body));
  await page.goto(`${APP}/inbox`);
  await text('Demo Rd & Test Ave', { exact: false }).waitFor();
  await shot('10-inbox-new-camera-ticket');
});

await step('tickets tab lists open tickets incl. overdue warning', async () => {
  await page.goto(`${APP}/fines`);
  await text('Overdue tickets block plate renewal.').waitFor();
  await shot('11-tickets');
});

await step('red light ticket detail shows owner liability, evidence and breakdown', async () => {
  await page.goto(`${APP}/fine/fine_rlc_1`);
  await text('Issued to the registered owner', { exact: false }).waitFor();
  await text('$390.00').waitFor();
  await text('Into red phase').waitFor();
  await shot('12-ticket-detail');
});

await step('renewal blocked while a ticket is overdue', async () => {
  await page.goto(`${APP}/vehicle/veh_alex_car`);
  await text('2021 Honda Civic', { exact: false }).waitFor();
  await btn('Renew plate').click();
  await text('overdue fine', { exact: false }).waitFor();
  await shot('13-renewal-blocked');
});

await step('pay the overdue officer ticket by card', async () => {
  await page.goto(`${APP}/fine/fine_officer_1`);
  await text('Demerit points: 3', { exact: false }).waitFor();
  await btn(/Pay now/).click();
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await shot('14-payment-sheet');
  await btn('Pay by card').click();
  await text('Payment complete').waitFor();
  await shot('15-payment-receipt');
});

await step('declined card keeps the ticket open', async () => {
  await page.goto(`${APP}/fine/fine_parking_1`);
  await btn(/Pay now/).click();
  await page.getByLabel('Card number').fill('4000 0000 0000 0002');
  await btn('Pay by card').click();
  await text('Payment declined', { exact: false }).waitFor();
});

await step('plate renewal succeeds once nothing is overdue', async () => {
  await page.goto(`${APP}/vehicle/veh_alex_car`);
  await text('2021 Honda Civic', { exact: false }).waitFor();
  await btn('2 years').click();
  await btn('Renew plate').click();
  await text('Renewed! New expiry', { exact: false }).waitFor();
  await shot('16-renewal-ok');
});

await step('dispute: request a trial', async () => {
  await page.goto(`${APP}/dispute/fine_rlc_1`);
  await text('Request a trial').click();
  await page.getByLabel('Tell us why (at least 10 characters)').fill('The signal was yellow when I entered the intersection.');
  await shot('17-dispute');
  await btn('Submit').click();
  await text('Request submitted. Reference', { exact: false }).waitFor();
});

await step('services catalogue + address change propagates', async () => {
  await page.goto(`${APP}/services`);
  await text('Change your address').waitFor();
  await shot('18-services');
  await text('Change your address').click();
  await page.getByLabel('Street address').fill('1 New Road');
  await page.getByLabel('City').fill('Hamilton');
  await page.getByLabel('Postal code').fill('L8P 4R5');
  await btn('Submit').click();
  await text('Request submitted', { exact: false }).waitFor();
  await page.goto(`${APP}/credential/cred_alex_dl`);
  await text('1 New Road', { exact: false }).waitFor();
});

await step('digital signature', async () => {
  await page.goto(`${APP}/sign`);
  await page.getByRole('checkbox').click();
  await btn('Sign document').click();
  await text('Document fingerprint (SHA-256)').waitFor();
  await shot('19-signed');
});

await step('French language', async () => {
  await page.goto(`${APP}/account`);
  await btn('Français').click();
  await page.goto(`${APP}/`);
  await text('Bonjour, Alex').waitFor();
  await text('Contraventions ouvertes').waitFor();
  await shot('20-home-fr');
  // switch back for the remaining steps
  await page.goto(`${APP}/account`);
  await btn('English').click();
});

await step('sign out', async () => {
  await btn('Sign out').click();
  await text('Create an account').waitFor();
});

await step('register a new person (Sam) and see their linked documents', async () => {
  await btn('Create an account').click();
  await page.getByLabel('Licence number').fill('L4321-09876-50302');
  await page.getByLabel('Date of birth (YYYY-MM-DD)').fill('1985-03-02');
  await shot('21-register-step1');
  await btn('Continue').click();
  await btn('Scan licence card').click();
  await btn('Take selfie (liveness check)').click();
  await shot('22-register-step2');
  await btn('Continue').click();
  await page.getByLabel('Email').fill(`sam+${Date.now()}@example.com`);
  await page.getByLabel('Password').fill('a-strong-passphrase');
  await btn('Create account').click();
  await text('Hello, Sam').waitFor({ timeout: 10000 });
  await shot('23-sam-home');
});

await browser.close();
console.log(results.join('\n'));
console.log(`\nconsole errors (${consoleErrors.length}):\n` + [...new Set(consoleErrors)].slice(0, 15).join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
