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
const text = (t, opts) => page.getByText(t, opts).filter({ visible: true }).first();
const btn = (name) => page.getByRole('button', { name }).first();
const GREETING = (name) => new RegExp(`(Good (morning|afternoon|evening)), ${name}`);
const pin = async (digits = '2580') => {
  for (const d of digits) await page.getByRole('button', { name: d, exact: true }).last().click();
};

await step('welcome screen', async () => {
  await page.goto(APP);
  await text('CivicPass').waitFor({ timeout: 20000 });
  await text('PROTOTYPE — not a valid government document').waitFor();
  await shot('01-welcome');
});

await step('sign in with demo account', async () => {
  await btn('Sign in').click();
  await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('T7654-32109-80514');
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Demo1234!');
  await shot('02-sign-in');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await text(GREETING('Alex')).waitFor({ timeout: 10000 });
  await text('Needs your attention').waitFor();
  await shot('03-home');
});

await step('wallet shows licence, health card, two vehicle permits', async () => {
  // Load the tab directly so the home screen's favourite-cards carousel isn't mounted.
  await page.goto(`${APP}/wallet`);
  await text("DRIVER'S LICENCE").waitFor();
  await text('HEALTH CARD').waitFor();
  const permits = await page.getByText('VEHICLE PERMIT').filter({ visible: true }).count();
  if (permits !== 2) throw new Error(`expected 2 vehicle permits, got ${permits}`);
  await shot('04-wallet');
});

await step('licence detail + QR presentation (full)', async () => {
  await page.getByRole('button', { name: "Driver's licence", exact: true }).first().click({ position: { x: 60, y: 22 } });
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
  await page.getByLabel('Your organization (shown to the holder)', { exact: true }).filter({ visible: true }).first().fill('Example Police Service');
  await page.getByLabel('Or paste a code', { exact: true }).filter({ visible: true }).first().fill(fullToken);
  await btn('Verify').click();
  await text('Verified').waitFor();
  await text('Tremblay').waitFor();
  await shot('07-verify-valid');
});

await step('verifier rejects a tampered token', async () => {
  const [h, p, s] = fullToken.split('.');
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
  forged.claims.surname = 'Impostor';
  await page.getByLabel('Or paste a code', { exact: true }).filter({ visible: true }).first().fill(`${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`);
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

await step('licence status is live and refreshes on open', async () => {
  await page.goto(`${APP}/credential/cred_alex_dl`);
  await text('Live check').waitFor();
  await text('This licence is valid and in good standing.').waitFor();
  await shot('09b-licence-status');
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
  await page.getByRole('checkbox').first().click();
  await btn('Renew plate').click();
  await text('overdue fine', { exact: false }).waitFor();
  await shot('13-renewal-blocked');
});

await step('pay the overdue officer ticket by card', async () => {
  await page.goto(`${APP}/fine/fine_officer_1`);
  await text('Demerit points: 3', { exact: false }).waitFor();
  await btn(/Pay now/).click();
  await page.getByLabel('Card number', { exact: true }).filter({ visible: true }).first().fill('4242 4242 4242 4242');
  await shot('14-payment-sheet');
  await btn('Pay by card').click();
  await text('Payment complete').waitFor();
  await shot('15-payment-receipt');
});

await step('declined card keeps the ticket open', async () => {
  await page.goto(`${APP}/fine/fine_parking_1`);
  await btn(/Pay now/).click();
  await page.getByLabel('Card number', { exact: true }).filter({ visible: true }).first().fill('4000 0000 0000 0002');
  await btn('Pay by card').click();
  await text('Payment declined', { exact: false }).waitFor();
});

await step('plate renewal succeeds once nothing is overdue', async () => {
  await page.goto(`${APP}/vehicle/veh_alex_car`);
  await text('2021 Honda Civic', { exact: false }).waitFor();
  await btn('2 years').click();
  await page.getByRole('checkbox').first().click();
  await btn('Renew plate').click();
  await text('Renewed! New expiry', { exact: false }).waitFor();
  await shot('16-renewal-ok');
});

await step('dispute: request a trial', async () => {
  await page.goto(`${APP}/dispute/fine_rlc_1`);
  await text('Request a trial').click();
  await page.getByLabel('Tell us why (at least 10 characters)', { exact: true }).filter({ visible: true }).first().fill('The signal was yellow when I entered the intersection.');
  await shot('17-dispute');
  await btn('Submit').click();
  await text('Request submitted. Reference', { exact: false }).waitFor();
});

await step('services catalogue + address change propagates', async () => {
  await page.goto(`${APP}/services`);
  await text('Most used').waitFor();
  await shot('18-services');
  await text('Change your address').first().click();
  await text('About this service').waitFor();
  await btn('Start service').click();
  await page.getByLabel('Street address', { exact: true }).filter({ visible: true }).first().fill('1 New Road');
  await page.getByLabel('City', { exact: true }).filter({ visible: true }).first().fill('Hamilton');
  await page.getByLabel('Postal code', { exact: true }).filter({ visible: true }).first().fill('L8P 4R5');
  await btn('Next').click();
  await page.getByRole('checkbox').first().click();
  await btn('Next').click();
  await btn('Submit request').click();
  await text('Application ID').waitFor();
  await page.goto(`${APP}/credential/cred_alex_dl`);
  await text('1 New Road', { exact: false }).waitFor();
});

await step('digital signature', async () => {
  await page.goto(`${APP}/sign`);
  await btn('Next').click();
  const box = await page.getByTestId('signature-pad').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 90);
  await page.mouse.down();
  for (let i = 1; i < 12; i++) await page.mouse.move(box.x + 30 + i * 20, box.y + 90 - Math.sin(i) * 25);
  await page.mouse.up();
  await btn('Next').click();
  await page.getByRole('checkbox').first().click();
  await pin();
  await text('Document fingerprint (SHA-256)').waitFor();
  await shot('19-signed');
});

await step('my requests: resubmit after "action required"', async () => {
  await page.goto(`${APP}/requests`);
  await text('Accessible parking permit').click();
  await text('Update and resubmit').waitFor();
  await page.getByLabel('Missing or corrected information', { exact: true }).filter({ visible: true }).first().fill('Registration CPSO 12345');
  await btn('Resubmit request').click();
  await text('Registration CPSO 12345').waitFor();
  await shot('24-request-resubmitted');
});

await step('pay a service later from My requests', async () => {
  await page.goto(`${APP}/services/vehicle-history`);
  await btn('Start service').click();
  await page.getByLabel('Vehicle identification number (VIN)', { exact: true }).filter({ visible: true }).first().fill('2T1BURHE0KC000003');
  await btn('Next').click();
  await page.getByRole('checkbox').first().click();
  await btn('Next').click();
  await btn('Submit request').click();
  await text('Awaiting payment').first().waitFor();
  await btn('View request').click();
  await btn(/Pay now/).click();
  await btn('Interac Debit').click();
  await text('Payment complete').waitFor();
  await btn('My requests').click();
  await text('Used vehicle history report (sample data)').waitFor();
  await shot('25-request-result');
});

await step('book an appointment, then check in to the one starting soon', async () => {
  await page.goto(`${APP}/appointments/book`);
  await text('ServiceOntario — Toronto Downtown').click();
  await text('Ontario Photo Card').click();
  await btn('Next').click();
  await page.getByRole('button', { name: /^\w{3}\.?,? \w{3}\.? \d{1,2}$/ }).nth(1).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^\d{2}:\d{2}$/ }).first().click();
  await btn('Next').click();
  await page.getByRole('checkbox').first().click();
  await btn('Confirm appointment').click();
  await text('Appointment booked').waitFor();
  await page.goto(`${APP}/appointments`);
  await text('Vision test', { exact: false }).click();
  await btn('Check in and get my ticket').click();
  await text('Your ticket').waitFor();
  await shot('26-queue-ticket');
});

await step('approve a data request with the digital ID PIN', async () => {
  await page.goto(`${APP}/consents`);
  await text('Example Car Rentals Inc.').waitFor();
  await page.getByRole('button', { name: /Approve$/ }).first().click();
  await pin('1111');
  await text('The digital ID PIN is incorrect.').waitFor();
  await pin();
  await text('Approved. The data is shared.').waitFor();
  await shot('27-consent-approved');
});

await step('personalized plates: taken, then order an available one', async () => {
  await page.goto(`${APP}/plates`);
  await page.getByPlaceholder(/Plate text/).fill('MAPLE');
  await btn('Check availability').click();
  await text('Already issued to another vehicle.').waitFor();
  await page.getByPlaceholder(/Plate text/).fill(`E2E ${Date.now() % 1000}`);
  await btn('Check availability').click();
  await text('Available', { exact: true }).waitFor();
  await btn(/CVPS 123/).click();
  await btn('Order these plates').click();
  await text('Order placed').waitFor();
  await shot('28-plate-order');
});

await step('French language', async () => {
  await page.goto(`${APP}/account`);
  await btn('Français').click();
  await page.goto(`${APP}/`);
  await text(/(Bonjour|Bon après-midi|Bonsoir), Alex/).waitFor();
  await text('À faire').waitFor();
  await shot('20-home-fr');
  // switch back for the remaining steps
  await page.goto(`${APP}/account`);
  await btn('English').click();
});

await step('sign out', async () => {
  await page.goto(`${APP}/account`);
  await btn('Sign out').click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await text('Create an account').waitFor();
});

await step('register a new person (Sam) and see their linked documents', async () => {
  await btn('Create an account').click();
  await page.getByLabel('Licence number', { exact: true }).filter({ visible: true }).first().fill('L4321-09876-50302');
  await page.getByLabel('Date of birth (YYYY-MM-DD)', { exact: true }).filter({ visible: true }).first().fill('1985-03-02');
  await shot('21-register-step1');
  await btn('Continue').click();
  await btn('Scan licence card').click();
  await btn('Take selfie (liveness check)').click();
  await shot('22-register-step2');
  await btn('Continue').click();
  await page.getByLabel('Mobile number', { exact: true }).filter({ visible: true }).first().fill('+1 613 555 0144');
  await btn('Send code').click();
  const hint = await text(/Your code: \d{6}/).textContent();
  await page.getByLabel('6-digit code', { exact: true }).filter({ visible: true }).first().fill(hint.match(/\d{6}/)[0]);
  await btn('Continue').click();
  await page.getByLabel('Email', { exact: true }).filter({ visible: true }).first().fill(`sam+${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Strong-Passphrase1');
  await page.getByLabel('Digital ID PIN (4 digits)', { exact: true }).filter({ visible: true }).first().fill('4826');
  await btn('Create account').click();
  await text(GREETING('Sam')).waitFor({ timeout: 10000 });
  await shot('23-sam-home');
});

await step('forgot password: phone, SMS code, new password', async () => {
  await page.goto(`${APP}/account`);
  await btn('Sign out').click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await btn('Sign in').click();
  await btn('Forgot password?').click();
  await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
  await btn('Next').click();
  await page.getByLabel('Mobile number', { exact: true }).filter({ visible: true }).first().fill('416 555 0100');
  await btn('Send code').click();
  const hint = await text(/Your code: \d{6}/).textContent();
  await page.getByLabel('6-digit code', { exact: true }).filter({ visible: true }).first().fill(hint.match(/\d{6}/)[0]);
  await btn('Verify').click();
  await page.getByLabel('New password', { exact: true }).filter({ visible: true }).first().fill('Reset-Pass1');
  await page.getByLabel('Confirm new password', { exact: true }).filter({ visible: true }).first().fill('Reset-Pass1');
  await btn('Change password').click();
  await text('Password changed').waitFor();
  await btn('Back to sign in').click();
  await page.getByLabel('Email or licence number', { exact: true }).filter({ visible: true }).first().fill('demo@civicpass.example');
  await page.getByLabel('Password', { exact: true }).filter({ visible: true }).first().fill('Reset-Pass1');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await text(GREETING('Alex')).waitFor({ timeout: 10000 });
});

await step('guest: browse services and locations without an account', async () => {
  await page.goto(`${APP}/account`);
  await btn('Sign out').click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await btn('Browse services').click();
  await text('Most used').waitFor();
  await text('Birth certificate').first().click();
  await btn('Sign in to start').waitFor();
  await page.goto(`${APP}/locations`);
  await text('DriveTest — London').waitFor();
  await shot('29-guest-locations');
});

await browser.close();
console.log(results.join('\n'));
console.log(`\nconsole errors (${consoleErrors.length}):\n` + [...new Set(consoleErrors)].slice(0, 15).join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
