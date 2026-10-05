import { hashPassword, newId } from './crypto.js';
import { addDays, fineTotals } from './fines.js';
import type { Store } from './store.js';
import type { Account, Fine } from './types.js';

// All people, numbers and plates below are fictional demo data.
export const DEMO_EMAIL = 'demo@civicpass.example';
export const DEMO_PASSWORD = 'Demo1234!';

export const DEMO_PEOPLE = {
  alex: { licenceNumber: 'T7654-32109-80514', dateOfBirth: '1990-05-14' },
  /** In the registry but without an app account: use to try registration. */
  sam: { licenceNumber: 'L4321-09876-50302', dateOfBirth: '1985-03-02' },
};

export const DEMO_PLATES = { alexCar: 'CVPS 123', alexBike: '7AB12', samCar: 'DEMO 456' };

export async function seed(store: Store): Promise<void> {
  const now = new Date();
  const iso = (offsetDays: number) => addDays(now.toISOString(), offsetDays);

  // --- Registry: Alex (has an app account) ----------------------------------
  const alex = {
    id: 'per_alex',
    licenceNumber: DEMO_PEOPLE.alex.licenceNumber,
    givenNames: 'Alex Jordan',
    surname: 'Tremblay',
    dateOfBirth: DEMO_PEOPLE.alex.dateOfBirth,
    sex: 'X' as const,
    heightCm: 175,
    address: { line1: '100 Example Street', line2: 'Unit 4', city: 'Toronto', province: 'ON', postalCode: 'M5V 0A1' },
  };
  store.people.set(alex.id, alex);

  store.vehicles.set('veh_alex_car', {
    id: 'veh_alex_car',
    ownerPersonId: alex.id,
    plate: DEMO_PLATES.alexCar,
    jurisdiction: 'ON',
    vin: '1HGCV1F30LA000001',
    make: 'Honda',
    model: 'Civic',
    year: 2021,
    colour: 'Blue',
    bodyType: 'SEDAN',
    plateValidationExpires: iso(24).slice(0, 10),
    insurance: { provider: 'Example Mutual', policyNumber: 'EM-55120-88', expiresOn: iso(140).slice(0, 10) },
  });
  store.vehicles.set('veh_alex_bike', {
    id: 'veh_alex_bike',
    ownerPersonId: alex.id,
    plate: DEMO_PLATES.alexBike,
    jurisdiction: 'ON',
    vin: 'JYARN23E09A000002',
    make: 'Yamaha',
    model: 'MT-07',
    year: 2019,
    colour: 'Black',
    bodyType: 'MOTORCYCLE',
    plateValidationExpires: iso(210).slice(0, 10),
    insurance: { provider: 'Example Mutual', policyNumber: 'EM-55120-91', expiresOn: iso(140).slice(0, 10) },
  });

  store.credentials.set('cred_alex_dl', {
    id: 'cred_alex_dl',
    personId: alex.id,
    type: 'driver_licence',
    documentNumber: alex.licenceNumber,
    issuedOn: '2022-05-14',
    expiresOn: '2027-05-14',
    status: 'valid',
    licenceClass: 'G, M',
    conditions: ['X — corrective lenses'],
  });
  store.credentials.set('cred_alex_hc', {
    id: 'cred_alex_hc',
    personId: alex.id,
    type: 'health_card',
    documentNumber: '9876-543-210-XY',
    issuedOn: '2021-05-14',
    expiresOn: '2026-11-14',
    status: 'valid',
  });
  store.credentials.set('cred_alex_vp_car', {
    id: 'cred_alex_vp_car',
    personId: alex.id,
    type: 'vehicle_permit',
    documentNumber: 'VP-21-0045521',
    issuedOn: '2021-08-02',
    expiresOn: iso(24).slice(0, 10),
    status: 'valid',
    vehicleId: 'veh_alex_car',
  });
  store.credentials.set('cred_alex_vp_bike', {
    id: 'cred_alex_vp_bike',
    personId: alex.id,
    type: 'vehicle_permit',
    documentNumber: 'VP-19-0099310',
    issuedOn: '2019-04-20',
    expiresOn: iso(210).slice(0, 10),
    status: 'valid',
    vehicleId: 'veh_alex_bike',
  });

  const account: Account = {
    id: 'acc_alex',
    personId: alex.id,
    email: DEMO_EMAIL,
    phone: '+1 416 555 0100',
    passwordHash: await hashPassword(DEMO_PASSWORD),
    language: 'en',
    createdAt: iso(-200),
    identityAssurance: 'IAL2',
    pushTokens: [],
  };
  store.accounts.set(account.id, account);

  const fines: Fine[] = [
    {
      id: 'fine_rlc_1',
      externalId: 'JPC-RLC-2026-000187',
      source: 'red_light_camera',
      liability: 'owner',
      personId: alex.id,
      vehicleId: 'veh_alex_car',
      plate: DEMO_PLATES.alexCar,
      offence: 'Fail to stop for red light — vehicle owner (camera)',
      statute: 'Highway Traffic Act — red light camera, owner liability',
      location: 'Example Ave & Sample St (northbound)',
      municipality: 'Toronto',
      occurredAt: iso(-6),
      issuedAt: iso(-3),
      dueDate: iso(12),
      ...fineTotals(325),
      demeritPoints: 0,
      status: 'outstanding',
      evidence: { images: ['evidence://rlc-000187-a.jpg', 'evidence://rlc-000187-b.jpg'], secondsIntoRed: 1.4 },
    },
    {
      id: 'fine_officer_1',
      externalId: 'POA-4471-889120',
      source: 'officer_issued',
      liability: 'driver',
      personId: alex.id,
      offence: 'Speeding — 72 km/h in a 50 km/h zone',
      statute: 'Highway Traffic Act s.128',
      location: 'Lakeshore Example Blvd W',
      municipality: 'Toronto',
      occurredAt: iso(-20),
      issuedAt: iso(-20),
      dueDate: iso(-5),
      ...fineTotals(95),
      demeritPoints: 3,
      status: 'outstanding',
    },
    {
      id: 'fine_ase_1',
      externalId: 'JPC-ASE-2025-104552',
      source: 'speed_camera',
      liability: 'owner',
      personId: alex.id,
      vehicleId: 'veh_alex_car',
      plate: DEMO_PLATES.alexCar,
      offence: 'Speeding 51 km/h in a 40 km/h zone — vehicle owner (camera)',
      statute: 'Highway Traffic Act s.128 — automated speed enforcement, owner liability',
      location: 'Sample Rd near Example Public School (community safety zone)',
      municipality: 'Toronto',
      occurredAt: '2025-10-02T14:12:00.000Z',
      issuedAt: '2025-10-09T10:00:00.000Z',
      dueDate: '2025-10-24T10:00:00.000Z',
      ...fineTotals(50),
      demeritPoints: 0,
      status: 'paid',
      evidence: { images: ['evidence://ase-104552.jpg'], recordedSpeedKmh: 51, postedLimitKmh: 40 },
      paymentId: 'pay_hist_1',
    },
    {
      id: 'fine_parking_1',
      externalId: 'PKG-TOR-77810023',
      source: 'parking',
      liability: 'owner',
      personId: alex.id,
      vehicleId: 'veh_alex_bike',
      plate: DEMO_PLATES.alexBike,
      offence: 'Park in a prohibited area during prohibited times',
      statute: 'Municipal parking by-law',
      location: '200 Sample Street',
      municipality: 'Toronto',
      occurredAt: iso(-2),
      issuedAt: iso(-2),
      dueDate: iso(13),
      setFine: 50,
      victimFineSurcharge: 0,
      courtCosts: 0,
      total: 50,
      demeritPoints: 0,
      status: 'outstanding',
    },
  ];
  for (const f of fines) store.fines.set(f.id, f);

  store.payments.set('pay_hist_1', {
    id: 'pay_hist_1',
    accountId: account.id,
    purpose: 'fine',
    referenceId: 'fine_ase_1',
    amount: fines[2]!.total,
    currency: 'CAD',
    method: 'apple_pay',
    status: 'succeeded',
    receiptNumber: 'RCPT-DEMO-0001',
    createdAt: '2025-10-11T16:30:00.000Z',
  });

  const msgs = [
    { category: 'fine' as const, title: 'New red light camera ticket', body: `Plate ${DEMO_PLATES.alexCar} was recorded at Example Ave & Sample St. Total payable: $390.00.`, link: '/fine/fine_rlc_1', createdAt: iso(-3), read: false },
    { category: 'renewal' as const, title: 'Plate renewal due soon', body: `The plate validation for ${DEMO_PLATES.alexCar} expires in 24 days. Renew in the app in under a minute.`, link: '/vehicle/veh_alex_car', createdAt: iso(-1), read: false },
    { category: 'security' as const, title: 'New device signed in', body: 'Your account was signed in on a new iPhone. If this was not you, revoke the device in Account → Devices.', createdAt: iso(-30), read: true },
  ];
  for (const m of msgs) {
    const id = newId('msg');
    store.inbox.set(id, { id, accountId: account.id, ...m });
  }

  // --- Registry: Sam (no account yet) ---------------------------------------
  const sam = {
    id: 'per_sam',
    licenceNumber: DEMO_PEOPLE.sam.licenceNumber,
    givenNames: 'Sam',
    surname: 'Example',
    dateOfBirth: DEMO_PEOPLE.sam.dateOfBirth,
    sex: 'F' as const,
    heightCm: 168,
    address: { line1: '55 Placeholder Rd', city: 'Ottawa', province: 'ON', postalCode: 'K1A 0B1' },
  };
  store.people.set(sam.id, sam);
  store.vehicles.set('veh_sam_car', {
    id: 'veh_sam_car',
    ownerPersonId: sam.id,
    plate: DEMO_PLATES.samCar,
    jurisdiction: 'ON',
    vin: '2T1BURHE0KC000003',
    make: 'Toyota',
    model: 'Corolla',
    year: 2019,
    colour: 'Silver',
    bodyType: 'SEDAN',
    plateValidationExpires: iso(90).slice(0, 10),
    insurance: { provider: 'Sample Insurance Co.', policyNumber: 'SIC-0091', expiresOn: iso(60).slice(0, 10) },
  });
  store.credentials.set('cred_sam_dl', {
    id: 'cred_sam_dl',
    personId: sam.id,
    type: 'driver_licence',
    documentNumber: sam.licenceNumber,
    issuedOn: '2023-03-02',
    expiresOn: '2028-03-02',
    status: 'valid',
    licenceClass: 'G',
  });
  store.credentials.set('cred_sam_vp', {
    id: 'cred_sam_vp',
    personId: sam.id,
    type: 'vehicle_permit',
    documentNumber: 'VP-19-0071234',
    issuedOn: '2019-06-11',
    expiresOn: iso(90).slice(0, 10),
    status: 'valid',
    vehicleId: 'veh_sam_car',
  });
}
