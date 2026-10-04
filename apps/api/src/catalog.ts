import type { ServiceDefinition } from './types.js';

// The service catalogue is data, not code: each ministry or municipality can
// publish services into the platform the way Sanad onboards 50+ entities.
// Fees below are placeholders — load the official fee schedule at deploy time.
export const SERVICES: ServiceDefinition[] = [
  {
    id: 'renew-licence',
    category: 'driver',
    name: { en: "Renew driver's licence", fr: 'Renouveler le permis de conduire' },
    description: {
      en: 'Renew your licence card and update your digital licence instantly.',
      fr: 'Renouvelez votre permis et mettez à jour votre permis numérique instantanément.',
    },
    fee: 90,
    online: true,
    fields: [
      { key: 'visionDeclaration', label: { en: 'I declare my vision meets the standard', fr: 'Je déclare que ma vue est conforme' }, type: 'select', options: ['Yes', 'No'], required: true },
    ],
  },
  {
    id: 'change-address',
    category: 'identity',
    name: { en: 'Change your address', fr: 'Changer votre adresse' },
    description: {
      en: 'One update changes your address on your licence, vehicle permit and health card.',
      fr: 'Une seule mise à jour change votre adresse sur le permis, le certificat d’immatriculation et la carte santé.',
    },
    fee: 0,
    online: true,
    fields: [
      { key: 'line1', label: { en: 'Street address', fr: 'Adresse' }, type: 'text', required: true },
      { key: 'city', label: { en: 'City', fr: 'Ville' }, type: 'text', required: true },
      { key: 'postalCode', label: { en: 'Postal code', fr: 'Code postal' }, type: 'text', required: true },
    ],
  },
  {
    id: 'replace-licence',
    category: 'driver',
    name: { en: 'Replace lost or stolen licence card', fr: 'Remplacer un permis perdu ou volé' },
    description: {
      en: 'Order a new physical card. Your digital licence stays valid meanwhile.',
      fr: 'Commandez une nouvelle carte. Votre permis numérique reste valide entre-temps.',
    },
    fee: 40,
    online: true,
    fields: [{ key: 'reason', label: { en: 'Reason', fr: 'Raison' }, type: 'select', options: ['Lost', 'Stolen', 'Damaged'], required: true }],
  },
  {
    id: 'driver-record',
    category: 'records',
    name: { en: 'Driver record (abstract)', fr: 'Dossier de conduite (relevé)' },
    description: { en: 'Get a certified copy of your driving record.', fr: 'Obtenez une copie certifiée de votre dossier de conduite.' },
    fee: 12,
    online: true,
    fields: [{ key: 'years', label: { en: 'Period', fr: 'Période' }, type: 'select', options: ['3 years', '5 years', 'Full history'], required: true }],
  },
  {
    id: 'book-road-test',
    category: 'driver',
    name: { en: 'Book a road test', fr: 'Réserver un examen pratique' },
    description: { en: 'Book a G2 or G road test at a centre near you.', fr: 'Réservez un examen G2 ou G près de chez vous.' },
    fee: 53,
    online: true,
    fields: [
      { key: 'level', label: { en: 'Test level', fr: "Niveau d'examen" }, type: 'select', options: ['G2', 'G'], required: true },
      { key: 'preferredDate', label: { en: 'Preferred date', fr: 'Date souhaitée' }, type: 'date', required: true },
    ],
  },
  {
    id: 'transfer-vehicle',
    category: 'vehicle',
    name: { en: 'Transfer vehicle ownership', fr: 'Transférer la propriété du véhicule' },
    description: { en: 'Sell or gift a vehicle and transfer the permit digitally.', fr: 'Vendez ou donnez un véhicule et transférez le certificat en ligne.' },
    fee: 32,
    online: true,
    fields: [
      { key: 'buyerLicence', label: { en: "Buyer's licence number", fr: "Numéro de permis de l'acheteur" }, type: 'text', required: true },
      { key: 'salePrice', label: { en: 'Sale price', fr: 'Prix de vente' }, type: 'text', required: true },
    ],
  },
  {
    id: 'accessible-parking',
    category: 'vehicle',
    name: { en: 'Accessible parking permit', fr: 'Permis de stationnement accessible' },
    description: { en: 'Apply for or renew an accessible parking permit.', fr: 'Demandez ou renouvelez un permis de stationnement accessible.' },
    fee: 0,
    online: true,
    fields: [{ key: 'practitioner', label: { en: 'Certifying practitioner name', fr: 'Nom du praticien certificateur' }, type: 'text', required: true }],
  },
  {
    id: 'renew-health-card',
    category: 'health',
    name: { en: 'Renew health card', fr: 'Renouveler la carte santé' },
    description: { en: 'Renew your health card online when eligible.', fr: 'Renouvelez votre carte santé en ligne si admissible.' },
    fee: 0,
    online: true,
    fields: [{ key: 'residency', label: { en: 'I live in the province 153+ days a year', fr: 'Je réside dans la province 153+ jours par an' }, type: 'select', options: ['Yes', 'No'], required: true }],
  },
];
