// CivicPass platform core: the parts of the service that are pure data and
// rules, shared by the API (apps/api) and the in-app demo backend
// (apps/mobile). Framework-free and dependency-free on purpose.
//
// SOURCE OF TRUTH: packages/shared/platform.ts. `node scripts/sync-shared.mjs`
// copies it into apps/api/src/shared and apps/mobile/src/lib/shared; an API
// test fails if the copies drift. Edit this file, never the copies.
//
// Feature set follows Jordan's Sanad app (sanad.gov.jo): a services directory
// grouped by government entity with a "service card" per service, request
// tracking with statuses, appointment booking with queue tickets, consent
// requests from third parties, distinguished (personalized) plates, a digital
// ID PIN, and a dashboard of "actions" that need the user's attention.
// Fees, locations and phone numbers are placeholders.

export type L = { en: string; fr: string };

export class PlatformError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new PlatformError(status, code, message);
};

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Directory: organizations and services
// ---------------------------------------------------------------------------

export type OrgId = 'serviceontario' | 'mto' | 'drivetest' | 'health' | 'registrar' | 'courts';

export interface Organization {
  id: OrgId;
  name: L;
  description: L;
  /** Ionicons name. */
  icon: string;
}

export const ORGANIZATIONS: Organization[] = [
  { id: 'serviceontario', name: { en: 'ServiceOntario', fr: 'ServiceOntario' }, description: { en: 'Licences, permits, plates, health cards and certificates.', fr: 'Permis, certificats d’immatriculation, plaques, cartes santé et certificats.' }, icon: 'business' },
  { id: 'mto', name: { en: 'Ministry of Transportation', fr: 'Ministère des Transports' }, description: { en: 'Driver records, licence renewals and road safety programs.', fr: 'Dossiers de conduite, renouvellements de permis et sécurité routière.' }, icon: 'car-sport' },
  { id: 'drivetest', name: { en: 'DriveTest centres', fr: 'Centres TestVolant' }, description: { en: 'Knowledge tests, road tests and vision tests.', fr: 'Examens théoriques, examens pratiques et examens de la vue.' }, icon: 'speedometer' },
  { id: 'health', name: { en: 'Ministry of Health', fr: 'Ministère de la Santé' }, description: { en: 'Health card registration and renewal.', fr: 'Inscription et renouvellement de la carte santé.' }, icon: 'medkit' },
  { id: 'registrar', name: { en: 'Office of the Registrar General', fr: 'Bureau du registraire général' }, description: { en: 'Birth, marriage and death certificates.', fr: 'Certificats de naissance, de mariage et de décès.' }, icon: 'document-text' },
  { id: 'courts', name: { en: 'Provincial offences courts', fr: 'Tribunaux des infractions provinciales' }, description: { en: 'Pay or dispute tickets issued under provincial offences.', fr: 'Payer ou contester des contraventions provinciales.' }, icon: 'scale' },
];

export type ServiceCategory = 'driver' | 'vehicle' | 'identity' | 'health' | 'records' | 'courts';
export type Channel = 'app' | 'web' | 'in_person';

export interface ServiceField {
  key: string;
  label: L;
  type: 'text' | 'date' | 'select';
  options?: string[];
  required: boolean;
}

export interface ServiceDefinition {
  id: string;
  orgId: OrgId;
  category: ServiceCategory;
  name: L;
  description: L;
  /** Total fee in CAD. Placeholder amounts: load the official schedule at deploy time. */
  fee: number;
  feeBreakdown?: { label: L; amount: number }[];
  online: boolean;
  channels: Channel[];
  steps: L[];
  conditions: L[];
  documents: L[];
  /** Business days until a decision; 0 means immediate. */
  processingDays: number;
  fields: ServiceField[];
  popular?: boolean;
  isNew?: boolean;
  /** Not listed in the directory (reached from another screen). */
  hidden?: boolean;
  /** Handled by a dedicated screen instead of the generic form. */
  link?: string;
  /** Needs an in-person visit that can be booked in the app. */
  bookable?: boolean;
  /** Completed as soon as it is submitted and paid. */
  instant?: boolean;
}

const yesNo = ['Yes', 'No'];
const STEP = {
  form: { en: 'Fill in the request', fr: 'Remplir la demande' },
  declare: { en: 'Confirm the declaration', fr: 'Confirmer la déclaration' },
  pay: { en: 'Pay the fee in the app', fr: 'Payer les frais dans l’application' },
  track: { en: 'Track it in My requests', fr: 'Suivre dans Mes demandes' },
  instant: { en: 'Your digital document updates right away', fr: 'Votre document numérique est mis à jour immédiatement' },
  visit: { en: 'Book a visit if asked to', fr: 'Prendre rendez-vous si on vous le demande' },
};
const COND = {
  resident: { en: 'You live in Ontario', fr: 'Vous habitez en Ontario' },
  verified: { en: 'Your digital ID is verified', fr: 'Votre identité numérique est vérifiée' },
  noDefault: { en: 'No unpaid defaulted fines on your record', fr: 'Aucune amende impayée en défaut à votre dossier' },
  owner: { en: 'You are the registered owner of the vehicle', fr: 'Vous êtes le propriétaire inscrit du véhicule' },
  insured: { en: 'The vehicle is insured', fr: 'Le véhicule est assuré' },
};
const DOCS = {
  none: { en: 'Nothing to upload: your records are checked automatically', fr: 'Rien à téléverser : vos dossiers sont vérifiés automatiquement' },
  vision: { en: 'Vision test result (done at a DriveTest centre or ServiceOntario)', fr: 'Résultat de l’examen de la vue (centre TestVolant ou ServiceOntario)' },
  police: { en: 'Police report number, if stolen', fr: 'Numéro du rapport de police, en cas de vol' },
  practitioner: { en: 'Certificate signed by a regulated health practitioner', fr: 'Certificat signé par un professionnel de la santé réglementé' },
  bill: { en: 'Signed bill of sale', fr: 'Acte de vente signé' },
  safety: { en: 'Safety Standards Certificate, if required', fr: 'Certificat de sécurité, s’il y a lieu' },
  photoId: { en: 'Original identity document for the photo visit', fr: 'Pièce d’identité originale pour la prise de photo' },
};

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'renew-licence', orgId: 'mto', category: 'driver', popular: true, instant: true, bookable: true,
    name: { en: "Renew driver's licence", fr: 'Renouveler le permis de conduire' },
    description: { en: 'Renew for five years. Your digital licence updates instantly and a new card is mailed.', fr: 'Renouvelez pour cinq ans. Votre permis numérique est mis à jour immédiatement et une carte vous est postée.' },
    fee: 90, feeBreakdown: [{ label: { en: 'Licence renewal (5 years)', fr: 'Renouvellement du permis (5 ans)' }, amount: 90 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [STEP.form, STEP.declare, STEP.pay, STEP.instant],
    conditions: [COND.resident, COND.noDefault, { en: 'Vision test passed in the last 12 months (book one if not)', fr: 'Examen de la vue réussi au cours des 12 derniers mois (sinon, prenez rendez-vous)' }],
    documents: [DOCS.vision],
    fields: [{ key: 'visionDeclaration', label: { en: 'I declare my vision meets the standard', fr: 'Je déclare que ma vue est conforme' }, type: 'select', options: yesNo, required: true }],
  },
  {
    id: 'change-address', orgId: 'serviceontario', category: 'identity', popular: true, instant: true,
    name: { en: 'Change your address', fr: 'Changer votre adresse' },
    description: { en: 'One update changes your address on your licence, vehicle permit and health card.', fr: 'Une seule mise à jour change votre adresse sur le permis, le certificat d’immatriculation et la carte santé.' },
    fee: 0, online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [STEP.form, STEP.declare, STEP.instant],
    conditions: [COND.resident, { en: 'Report the change within 6 days of moving', fr: 'Déclarez le changement dans les 6 jours suivant le déménagement' }],
    documents: [DOCS.none],
    fields: [
      { key: 'line1', label: { en: 'Street address', fr: 'Adresse' }, type: 'text', required: true },
      { key: 'city', label: { en: 'City', fr: 'Ville' }, type: 'text', required: true },
      { key: 'postalCode', label: { en: 'Postal code', fr: 'Code postal' }, type: 'text', required: true },
    ],
  },
  {
    id: 'renew-plate', orgId: 'serviceontario', category: 'vehicle', popular: true, link: '/vehicles',
    name: { en: 'Renew licence plate', fr: 'Renouveler la plaque d’immatriculation' },
    description: { en: 'Renew your plate validation for one or two years.', fr: 'Renouvelez la validation de votre plaque pour un ou deux ans.' },
    fee: 0, online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [{ en: 'Choose the vehicle', fr: 'Choisir le véhicule' }, STEP.declare, STEP.instant],
    conditions: [COND.owner, COND.insured, { en: 'No overdue tickets on your record', fr: 'Aucune contravention en retard à votre dossier' }],
    documents: [DOCS.none],
    fields: [],
  },
  {
    id: 'pay-ticket', orgId: 'courts', category: 'courts', popular: true, link: '/fines',
    name: { en: 'Pay or dispute a ticket', fr: 'Payer ou contester une contravention' },
    description: { en: 'Camera, parking and officer-issued tickets linked to your licence and plates.', fr: 'Contraventions de caméra, de stationnement et d’agents liées à votre permis et à vos plaques.' },
    fee: 0, online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [{ en: 'Open the ticket', fr: 'Ouvrir la contravention' }, { en: 'Pay, request a meeting or request a trial', fr: 'Payer, demander une rencontre ou un procès' }],
    conditions: [{ en: 'Respond within 15 days of the notice', fr: 'Répondre dans les 15 jours suivant l’avis' }],
    documents: [DOCS.none],
    fields: [],
  },
  {
    id: 'personalized-plates', orgId: 'serviceontario', category: 'vehicle', popular: true, isNew: true, link: '/plates',
    name: { en: 'Order personalized plates', fr: 'Commander des plaques personnalisées' },
    description: { en: 'Check if your combination is available and order it in the app.', fr: 'Vérifiez si votre combinaison est libre et commandez-la dans l’application.' },
    fee: 0, online: true, channels: ['app', 'web', 'in_person'], processingDays: 10,
    steps: [{ en: 'Search for a combination', fr: 'Rechercher une combinaison' }, { en: 'Confirm and submit', fr: 'Confirmer et soumettre' }, STEP.pay, { en: 'Plates are mailed to you', fr: 'Les plaques vous sont postées' }],
    conditions: [{ en: '2 to 8 characters, letters and numbers', fr: '2 à 8 caractères, lettres et chiffres' }, { en: 'Not offensive and not already issued', fr: 'Ni offensante ni déjà attribuée' }],
    documents: [DOCS.none],
    fields: [],
  },
  {
    id: 'vehicle-history', orgId: 'serviceontario', category: 'vehicle', isNew: true, instant: true,
    name: { en: 'Used vehicle history report', fr: 'Rapport d’historique de véhicule d’occasion' },
    description: { en: 'Registration history, liens check and odometer readings for any Ontario VIN.', fr: 'Historique d’immatriculation, vérification des privilèges et relevés d’odomètre pour tout NIV de l’Ontario.' },
    fee: 20, feeBreakdown: [{ label: { en: 'Vehicle history report', fr: 'Rapport d’historique' }, amount: 20 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [STEP.form, STEP.pay, { en: 'Read the report in My requests', fr: 'Lire le rapport dans Mes demandes' }],
    conditions: [{ en: 'The vehicle was registered in Ontario', fr: 'Le véhicule a été immatriculé en Ontario' }],
    documents: [DOCS.none],
    fields: [{ key: 'vin', label: { en: 'Vehicle identification number (VIN)', fr: 'Numéro d’identification du véhicule (NIV)' }, type: 'text', required: true }],
  },
  {
    id: 'transfer-vehicle', orgId: 'serviceontario', category: 'vehicle',
    name: { en: 'Transfer vehicle ownership', fr: 'Transférer la propriété du véhicule' },
    description: { en: 'Sell or gift a vehicle and transfer the permit digitally.', fr: 'Vendez ou donnez un véhicule et transférez le certificat en ligne.' },
    fee: 32, feeBreakdown: [{ label: { en: 'Permit transfer', fr: 'Transfert du certificat' }, amount: 32 }],
    online: true, channels: ['app', 'in_person'], processingDays: 2,
    steps: [STEP.form, STEP.declare, STEP.pay, { en: 'The buyer confirms in their app', fr: 'L’acheteur confirme dans son application' }, STEP.track],
    conditions: [COND.owner, { en: 'The buyer has an Ontario licence', fr: 'L’acheteur a un permis de l’Ontario' }],
    documents: [DOCS.bill, DOCS.safety],
    fields: [
      { key: 'buyerLicence', label: { en: "Buyer's licence number", fr: "Numéro de permis de l'acheteur" }, type: 'text', required: true },
      { key: 'salePrice', label: { en: 'Sale price', fr: 'Prix de vente' }, type: 'text', required: true },
    ],
  },
  {
    id: 'replace-plates', orgId: 'serviceontario', category: 'vehicle',
    name: { en: 'Replace lost or damaged plates', fr: 'Remplacer des plaques perdues ou endommagées' },
    description: { en: 'Order replacement plates; the old number is cancelled.', fr: 'Commandez des plaques de remplacement; l’ancien numéro est annulé.' },
    fee: 59, feeBreakdown: [{ label: { en: 'Replacement plates', fr: 'Plaques de remplacement' }, amount: 59 }],
    online: true, channels: ['app', 'in_person'], processingDays: 5,
    steps: [STEP.form, STEP.pay, STEP.track],
    conditions: [COND.owner, COND.insured],
    documents: [DOCS.police],
    fields: [
      { key: 'plate', label: { en: 'Plate number', fr: 'Numéro de plaque' }, type: 'text', required: true },
      { key: 'reason', label: { en: 'Reason', fr: 'Raison' }, type: 'select', options: ['Lost', 'Stolen', 'Damaged'], required: true },
    ],
  },
  {
    id: 'replace-permit', orgId: 'serviceontario', category: 'vehicle', instant: true,
    name: { en: 'Replace vehicle permit', fr: 'Remplacer le certificat d’immatriculation' },
    description: { en: 'Replace a lost or damaged vehicle permit. The digital copy stays valid.', fr: 'Remplacez un certificat perdu ou endommagé. La copie numérique reste valide.' },
    fee: 32, feeBreakdown: [{ label: { en: 'Permit replacement', fr: 'Remplacement du certificat' }, amount: 32 }],
    online: true, channels: ['app', 'in_person'], processingDays: 0,
    steps: [STEP.form, STEP.pay, STEP.instant],
    conditions: [COND.owner],
    documents: [DOCS.none],
    fields: [{ key: 'plate', label: { en: 'Plate number', fr: 'Numéro de plaque' }, type: 'text', required: true }],
  },
  {
    id: 'accessible-parking', orgId: 'mto', category: 'vehicle',
    name: { en: 'Accessible parking permit', fr: 'Permis de stationnement accessible' },
    description: { en: 'Apply for or renew an accessible parking permit.', fr: 'Demandez ou renouvelez un permis de stationnement accessible.' },
    fee: 0, online: true, channels: ['app', 'in_person'], processingDays: 10,
    steps: [STEP.form, { en: 'A practitioner certifies your application', fr: 'Un praticien certifie votre demande' }, STEP.track],
    conditions: [COND.resident, { en: 'A health condition limits your mobility', fr: 'Un problème de santé limite votre mobilité' }],
    documents: [DOCS.practitioner],
    fields: [{ key: 'practitioner', label: { en: 'Certifying practitioner name', fr: 'Nom du praticien certificateur' }, type: 'text', required: true }],
  },
  {
    id: 'replace-licence', orgId: 'serviceontario', category: 'driver',
    name: { en: 'Replace lost or stolen licence card', fr: 'Remplacer un permis perdu ou volé' },
    description: { en: 'Order a new physical card. Your digital licence stays valid meanwhile.', fr: 'Commandez une nouvelle carte. Votre permis numérique reste valide entre-temps.' },
    fee: 40, feeBreakdown: [{ label: { en: 'Replacement card', fr: 'Carte de remplacement' }, amount: 40 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 3,
    steps: [STEP.form, STEP.pay, { en: 'A new card is mailed in 4 to 6 weeks', fr: 'Une nouvelle carte est postée en 4 à 6 semaines' }],
    conditions: [COND.resident],
    documents: [DOCS.police],
    fields: [{ key: 'reason', label: { en: 'Reason', fr: 'Raison' }, type: 'select', options: ['Lost', 'Stolen', 'Damaged'], required: true }],
  },
  {
    id: 'book-road-test', orgId: 'drivetest', category: 'driver',
    name: { en: 'Book a road test', fr: 'Réserver un examen pratique' },
    description: { en: 'Book a G2 or G road test at a centre near you.', fr: 'Réservez un examen G2 ou G près de chez vous.' },
    fee: 53, feeBreakdown: [{ label: { en: 'Road test', fr: 'Examen pratique' }, amount: 53 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 1,
    steps: [STEP.form, STEP.pay, { en: 'The centre confirms your time', fr: 'Le centre confirme votre heure' }],
    conditions: [{ en: 'You held your current licence level long enough', fr: 'Vous détenez votre niveau de permis depuis assez longtemps' }],
    documents: [{ en: 'Bring your licence and a road-worthy vehicle', fr: 'Apportez votre permis et un véhicule en bon état' }],
    fields: [
      { key: 'level', label: { en: 'Test level', fr: "Niveau d'examen" }, type: 'select', options: ['G2', 'G'], required: true },
      { key: 'preferredDate', label: { en: 'Preferred date', fr: 'Date souhaitée' }, type: 'date', required: true },
    ],
  },
  {
    id: 'driver-record', orgId: 'mto', category: 'records', popular: true, instant: true,
    name: { en: 'Driver record (abstract)', fr: 'Dossier de conduite (relevé)' },
    description: { en: 'Get a certified copy of your driving record.', fr: 'Obtenez une copie certifiée de votre dossier de conduite.' },
    fee: 12, feeBreakdown: [{ label: { en: 'Certified abstract', fr: 'Relevé certifié' }, amount: 12 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 0,
    steps: [STEP.form, STEP.pay, { en: 'Read and share it from My requests', fr: 'Le consulter et le partager depuis Mes demandes' }],
    conditions: [COND.verified],
    documents: [DOCS.none],
    fields: [{ key: 'years', label: { en: 'Period', fr: 'Période' }, type: 'select', options: ['3 years', '5 years', 'Full history'], required: true }],
  },
  {
    id: 'photo-card', orgId: 'serviceontario', category: 'identity', bookable: true,
    name: { en: 'Ontario Photo Card', fr: 'Carte-photo de l’Ontario' },
    description: { en: 'Government photo ID for people who don’t drive.', fr: 'Pièce d’identité avec photo pour les personnes qui ne conduisent pas.' },
    fee: 35, feeBreakdown: [{ label: { en: 'Photo card (8 years)', fr: 'Carte-photo (8 ans)' }, amount: 35 }],
    online: true, channels: ['app', 'in_person'], processingDays: 5,
    steps: [STEP.form, STEP.pay, { en: 'Book a photo visit', fr: 'Prendre rendez-vous pour la photo' }, STEP.track],
    conditions: [COND.resident, { en: 'You are 16 or older and don’t hold a licence', fr: 'Vous avez 16 ans ou plus et n’avez pas de permis' }],
    documents: [DOCS.photoId],
    fields: [{ key: 'reason', label: { en: 'Application type', fr: 'Type de demande' }, type: 'select', options: ['New', 'Renewal'], required: true }],
  },
  {
    id: 'renew-health-card', orgId: 'health', category: 'health', bookable: true,
    name: { en: 'Renew health card', fr: 'Renouveler la carte santé' },
    description: { en: 'Renew your health card online when eligible.', fr: 'Renouvelez votre carte santé en ligne si admissible.' },
    fee: 0, online: true, channels: ['app', 'web', 'in_person'], processingDays: 3,
    steps: [STEP.form, STEP.declare, STEP.track],
    conditions: [COND.resident, { en: 'You live in Ontario at least 153 days a year', fr: 'Vous habitez en Ontario au moins 153 jours par an' }],
    documents: [DOCS.none],
    fields: [{ key: 'residency', label: { en: 'I live in the province 153+ days a year', fr: 'Je réside dans la province 153+ jours par an' }, type: 'select', options: yesNo, required: true }],
  },
  {
    id: 'birth-certificate', orgId: 'registrar', category: 'records', isNew: true,
    name: { en: 'Birth certificate', fr: 'Certificat de naissance' },
    description: { en: 'Order a birth certificate for a birth registered in Ontario.', fr: 'Commandez un certificat de naissance pour une naissance enregistrée en Ontario.' },
    fee: 25, feeBreakdown: [{ label: { en: 'Certificate', fr: 'Certificat' }, amount: 25 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 15,
    steps: [STEP.form, STEP.pay, { en: 'The certificate is mailed', fr: 'Le certificat est posté' }],
    conditions: [{ en: 'The certificate is yours or you are eligible to order it', fr: 'Le certificat est le vôtre ou vous êtes admissible à le commander' }],
    documents: [DOCS.none],
    fields: [
      { key: 'form', label: { en: 'Certificate type', fr: 'Type de certificat' }, type: 'select', options: ['Short form', 'Long form'], required: true },
      { key: 'purpose', label: { en: 'Purpose', fr: 'Raison' }, type: 'select', options: ['Passport', 'School', 'Other'], required: true },
    ],
  },
  {
    id: 'marriage-certificate', orgId: 'registrar', category: 'records',
    name: { en: 'Marriage certificate', fr: 'Certificat de mariage' },
    description: { en: 'Order a certificate for a marriage registered in Ontario.', fr: 'Commandez un certificat pour un mariage enregistré en Ontario.' },
    fee: 15, feeBreakdown: [{ label: { en: 'Certificate', fr: 'Certificat' }, amount: 15 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 15,
    steps: [STEP.form, STEP.pay, { en: 'The certificate is mailed', fr: 'Le certificat est posté' }],
    conditions: [{ en: 'You are one of the spouses or eligible to order it', fr: 'Vous êtes l’un des époux ou admissible à le commander' }],
    documents: [DOCS.none],
    fields: [
      { key: 'spouse', label: { en: "Spouse's full name", fr: 'Nom complet de l’époux ou de l’épouse' }, type: 'text', required: true },
      { key: 'date', label: { en: 'Date of marriage', fr: 'Date du mariage' }, type: 'date', required: true },
    ],
  },
  {
    id: 'death-certificate', orgId: 'registrar', category: 'records',
    name: { en: 'Death certificate', fr: 'Certificat de décès' },
    description: { en: 'Order a certificate for a death registered in Ontario.', fr: 'Commandez un certificat pour un décès enregistré en Ontario.' },
    fee: 15, feeBreakdown: [{ label: { en: 'Certificate', fr: 'Certificat' }, amount: 15 }],
    online: true, channels: ['app', 'web', 'in_person'], processingDays: 15,
    steps: [STEP.form, STEP.pay, { en: 'The certificate is mailed', fr: 'Le certificat est posté' }],
    conditions: [{ en: 'You are next of kin, the estate trustee or otherwise eligible', fr: 'Vous êtes le plus proche parent, le fiduciaire de la succession ou autrement admissible' }],
    documents: [DOCS.none],
    fields: [
      { key: 'name', label: { en: 'Full name of the deceased', fr: 'Nom complet de la personne décédée' }, type: 'text', required: true },
      { key: 'date', label: { en: 'Date of death', fr: 'Date du décès' }, type: 'date', required: true },
    ],
  },
  {
    id: 'document-correction', orgId: 'serviceontario', category: 'identity', hidden: true,
    name: { en: 'Correct information on a document', fr: 'Corriger l’information d’un document' },
    description: { en: 'Ask the issuer to fix information shown on one of your documents.', fr: 'Demandez à l’émetteur de corriger l’information d’un de vos documents.' },
    fee: 0, online: true, channels: ['app'], processingDays: 5,
    steps: [{ en: 'Select the information to update', fr: 'Choisir l’information à mettre à jour' }, { en: 'Describe the correction', fr: 'Décrire la correction' }, STEP.track],
    conditions: [], documents: [DOCS.none],
    fields: [
      { key: 'credentialId', label: { en: 'Document', fr: 'Document' }, type: 'text', required: true },
      { key: 'fields', label: { en: 'Information to update', fr: 'Information à mettre à jour' }, type: 'text', required: true },
      { key: 'details', label: { en: 'Correct information', fr: 'Information exacte' }, type: 'text', required: true },
    ],
  },
  {
    id: 'unlisted-document', orgId: 'serviceontario', category: 'identity', hidden: true,
    name: { en: 'Add a missing document', fr: 'Ajouter un document manquant' },
    description: { en: 'Tell us about a document you hold that isn’t in your wallet yet.', fr: 'Signalez un document que vous détenez et qui n’est pas encore dans votre portefeuille.' },
    fee: 0, online: true, channels: ['app'], processingDays: 10,
    steps: [STEP.form, STEP.track], conditions: [], documents: [DOCS.none],
    fields: [
      { key: 'document', label: { en: 'Document name', fr: 'Nom du document' }, type: 'text', required: true },
      { key: 'details', label: { en: 'Details', fr: 'Détails' }, type: 'text', required: false },
    ],
  },
];

export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);

/** Throws `missing_fields` (400) when a required field is blank. */
export function validateServiceData(service: ServiceDefinition, data: Record<string, string>): void {
  const missing = service.fields.filter((f) => f.required && !data[f.key]?.trim()).map((f) => f.key);
  if (missing.length) fail(400, 'missing_fields', `Missing: ${missing.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Service requests ("My requests")
// ---------------------------------------------------------------------------

export type RequestStatus = 'in_review' | 'action_required' | 'awaiting_payment' | 'completed' | 'rejected' | 'cancelled';

export interface RequestEvent {
  status: RequestStatus | 'submitted';
  at: string;
  note?: L;
}

export interface RequestResultLine {
  label: L;
  value: string;
}

export interface ServiceRequest {
  id: string;
  accountId: string;
  serviceId: string;
  data: Record<string, string>;
  status: RequestStatus;
  reference: string;
  createdAt: string;
  updatedAt: string;
  amount: number;
  paymentId?: string;
  /** Why the request needs the user's attention or was rejected. */
  note?: L;
  history: RequestEvent[];
  /** Read-only output for instant services (e.g. a driver record). */
  result?: { title: L; lines: RequestResultLine[] };
}

export function createRequest(input: {
  id: string;
  reference: string;
  accountId: string;
  service: ServiceDefinition;
  data: Record<string, string>;
  amount?: number;
  paymentId?: string;
  now: Date;
}): ServiceRequest {
  const at = input.now.toISOString();
  const amount = input.amount ?? input.service.fee;
  const r: ServiceRequest = {
    id: input.id,
    accountId: input.accountId,
    serviceId: input.service.id,
    data: input.data,
    status: 'in_review',
    reference: input.reference,
    createdAt: at,
    updatedAt: at,
    amount,
    history: [{ status: 'submitted', at }],
  };
  if (amount > 0 && !input.paymentId) return transition(r, 'awaiting_payment', input.now);
  if (input.paymentId) r.paymentId = input.paymentId;
  return transition(r, input.service.instant ? 'completed' : 'in_review', input.now);
}

function transition(r: ServiceRequest, status: RequestStatus, now: Date, note?: L): ServiceRequest {
  r.status = status;
  r.updatedAt = now.toISOString();
  r.note = note;
  r.history.push({ status, at: r.updatedAt, ...(note ? { note } : {}) });
  return r;
}

export function payRequest(r: ServiceRequest, paymentId: string, now: Date): ServiceRequest {
  if (r.status !== 'awaiting_payment') fail(409, 'not_payable', `Request is ${r.status}`);
  r.paymentId = paymentId;
  return transition(r, serviceById(r.serviceId)?.instant ? 'completed' : 'in_review', now);
}

export function cancelRequest(r: ServiceRequest, now: Date): ServiceRequest {
  if (!['in_review', 'awaiting_payment', 'action_required'].includes(r.status)) fail(409, 'not_cancellable', `Request is ${r.status}`);
  return transition(r, 'cancelled', now);
}

/** After "action required", the user corrects the data and sends it back. */
export function resubmitRequest(r: ServiceRequest, data: Record<string, string>, now: Date): ServiceRequest {
  if (r.status !== 'action_required') fail(409, 'not_resubmittable', `Request is ${r.status}`);
  r.data = { ...r.data, ...data };
  return transition(r, 'in_review', now);
}

export function requireAction(r: ServiceRequest, note: L, now: Date): ServiceRequest {
  return transition(r, 'action_required', now, note);
}

// ---------------------------------------------------------------------------
// Locations and appointments
// ---------------------------------------------------------------------------

export interface Location {
  id: string;
  orgId: 'serviceontario' | 'drivetest';
  name: L;
  address: string;
  city: string;
  phone: string;
  hours: L;
  /** Services that can be booked here. */
  services: string[];
  accessible: boolean;
}

const SO_SERVICES = ['renew-licence', 'photo-card', 'renew-health-card', 'replace-licence', 'transfer-vehicle', 'replace-plates', 'general'];
const DT_SERVICES = ['renew-licence', 'book-road-test', 'vision-test'];
const SO_HOURS = { en: 'Mon–Fri 8:30–17:00 · Sat 9:00–13:00', fr: 'lun.–ven. 8 h 30–17 h · sam. 9 h–13 h' };
const DT_HOURS = { en: 'Mon–Sat 8:30–17:00', fr: 'lun.–sam. 8 h 30–17 h' };

// Sample locations: names, addresses and phone numbers are fictional.
export const LOCATIONS: Location[] = [
  { id: 'loc_tor_dt', orgId: 'serviceontario', name: { en: 'ServiceOntario — Toronto Downtown', fr: 'ServiceOntario — Centre-ville de Toronto' }, address: '100 Sample Street', city: 'Toronto', phone: '416-555-0110', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_tor_north', orgId: 'serviceontario', name: { en: 'ServiceOntario — North York', fr: 'ServiceOntario — North York' }, address: '45 Example Avenue', city: 'Toronto', phone: '416-555-0111', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_tor_drive', orgId: 'drivetest', name: { en: 'DriveTest — Toronto Etobicoke', fr: 'TestVolant — Toronto Etobicoke' }, address: '9 Placeholder Road', city: 'Toronto', phone: '416-555-0120', hours: DT_HOURS, services: DT_SERVICES, accessible: true },
  { id: 'loc_ott', orgId: 'serviceontario', name: { en: 'ServiceOntario — Ottawa Centre', fr: 'ServiceOntario — Centre d’Ottawa' }, address: '12 Demo Boulevard', city: 'Ottawa', phone: '613-555-0130', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_ott_drive', orgId: 'drivetest', name: { en: 'DriveTest — Ottawa Walkley', fr: 'TestVolant — Ottawa Walkley' }, address: '300 Sample Drive', city: 'Ottawa', phone: '613-555-0131', hours: DT_HOURS, services: DT_SERVICES, accessible: false },
  { id: 'loc_mis', orgId: 'serviceontario', name: { en: 'ServiceOntario — Mississauga', fr: 'ServiceOntario — Mississauga' }, address: '77 Example Way', city: 'Mississauga', phone: '905-555-0140', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_ham', orgId: 'serviceontario', name: { en: 'ServiceOntario — Hamilton', fr: 'ServiceOntario — Hamilton' }, address: '5 Model Street', city: 'Hamilton', phone: '905-555-0150', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_lon_drive', orgId: 'drivetest', name: { en: 'DriveTest — London', fr: 'TestVolant — London' }, address: '18 Test Lane', city: 'London', phone: '519-555-0160', hours: DT_HOURS, services: DT_SERVICES, accessible: true },
  { id: 'loc_sud', orgId: 'serviceontario', name: { en: 'ServiceOntario — Sudbury', fr: 'ServiceOntario — Sudbury' }, address: '61 Sample Crescent', city: 'Sudbury', phone: '705-555-0170', hours: SO_HOURS, services: SO_SERVICES, accessible: true },
  { id: 'loc_kin', orgId: 'serviceontario', name: { en: 'ServiceOntario — Kingston', fr: 'ServiceOntario — Kingston' }, address: '23 Example Court', city: 'Kingston', phone: '613-555-0180', hours: SO_HOURS, services: SO_SERVICES, accessible: false },
];

/** Things you can book that aren't online services. */
export const VISIT_REASONS: Record<string, L> = {
  general: { en: 'General enquiry', fr: 'Demande générale' },
  'vision-test': { en: 'Vision test', fr: 'Examen de la vue' },
};

export const visitName = (serviceId: string): L => serviceById(serviceId)?.name ?? VISIT_REASONS[serviceId] ?? { en: serviceId, fr: serviceId };

export function visitRequirements(serviceId: string): L[] {
  const s = serviceById(serviceId);
  const base: L[] = [{ en: 'Your digital licence or photo ID', fr: 'Votre permis numérique ou une pièce d’identité avec photo' }];
  if (serviceId === 'vision-test') return [...base, { en: 'Glasses or contact lenses, if you wear them', fr: 'Vos lunettes ou verres de contact, si vous en portez' }];
  if (!s) return base;
  return [...base, ...s.documents.filter((d) => d !== DOCS.none)];
}

export type AppointmentStatus = 'upcoming' | 'checked_in' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  accountId: string;
  locationId: string;
  serviceId: string;
  /** Wall-clock date and time at the location (Ontario time), for display. */
  date: string;
  time: string;
  /** Absolute start time. */
  startsAt: string;
  status: AppointmentStatus;
  reference: string;
  createdAt: string;
  ticket?: { number: string; issuedAt: string; peopleAhead: number };
}

/** Minutes east of UTC for Ontario (Eastern time) at an instant: −240 in summer, −300 in winter. */
export function ontarioOffsetMinutes(at: Date): number {
  const y = at.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1));
    return 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7;
  };
  // DST: second Sunday of March 2:00 EST (07:00 UTC) to first Sunday of November 2:00 EDT (06:00 UTC).
  const start = Date.UTC(y, 2, nthSunday(2, 2), 7);
  const end = Date.UTC(y, 10, nthSunday(10, 1), 6);
  const t = at.getTime();
  return t >= start && t < end ? -240 : -300;
}

/** Ontario wall-clock date (YYYY-MM-DD) and time (HH:MM) for an instant. */
export function ontarioClock(at: Date): { date: string; time: string } {
  const local = new Date(at.getTime() + ontarioOffsetMinutes(at) * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** The instant of an Ontario wall-clock date and time. */
export function ontarioInstant(date: string, time: string): Date {
  const guess = new Date(`${date}T${time}:00.000Z`);
  return new Date(guess.getTime() - ontarioOffsetMinutes(guess) * 60_000);
}

/** Bookable days: the next 7 days, closed on Sundays. Sanad allows booking up to one week ahead. */
export function bookableDates(now: Date): string[] {
  const out: string[] = [];
  const today = ontarioClock(now).date;
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.parse(`${today}T12:00:00.000Z`) + i * DAY);
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type Period = 'morning' | 'afternoon' | 'evening';

export interface Slot {
  time: string;
  startsAt: string;
  period: Period;
}

/**
 * Free 20-minute slots at a location on a date. Availability is
 * deterministic (a stand-in for the centre's queue system), minus slots
 * already booked and slots in the past.
 */
export function availableSlots(locationId: string, date: string, booked: Set<string>, now: Date): Slot[] {
  const loc = LOCATIONS.find((l) => l.id === locationId);
  if (!loc) return fail(404, 'not_found', 'Location not found');
  if (!bookableDates(now).includes(date)) return [];
  const saturday = new Date(`${date}T12:00:00.000Z`).getUTCDay() === 6;
  const close = saturday && loc.orgId === 'serviceontario' ? 13 * 60 : 17 * 60;
  const out: Slot[] = [];
  for (let m = 8 * 60 + 30; m + 20 <= close; m += 20) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (hash(`${locationId}|${date}|${time}`) % 3 === 0) continue; // taken by others
    const startsAt = ontarioInstant(date, time);
    if (startsAt.getTime() < now.getTime() + 30 * 60_000) continue;
    if (booked.has(`${locationId}|${startsAt.toISOString()}`)) continue;
    out.push({ time, startsAt: startsAt.toISOString(), period: m < 12 * 60 ? 'morning' : m < 15 * 60 ? 'afternoon' : 'evening' });
  }
  return out;
}

export function bookAppointment(input: {
  id: string;
  reference: string;
  accountId: string;
  locationId: string;
  serviceId: string;
  startsAt: string;
  acknowledged: boolean;
  existing: Appointment[];
  now: Date;
}): Appointment {
  const loc = LOCATIONS.find((l) => l.id === input.locationId);
  if (!loc) return fail(404, 'not_found', 'Location not found');
  if (!loc.services.includes(input.serviceId)) fail(400, 'service_not_offered', 'This location does not offer that service.');
  if (!input.acknowledged) fail(400, 'requirements_not_acknowledged', 'Confirm you will bring the required documents.');
  const start = new Date(input.startsAt);
  const { date, time } = ontarioClock(start);
  const booked = new Set(input.existing.filter((a) => a.status !== 'cancelled').map((a) => `${a.locationId}|${a.startsAt}`));
  const free = availableSlots(loc.id, date, booked, input.now).some((s) => s.startsAt === start.toISOString());
  if (!free) fail(409, 'slot_unavailable', 'That time is no longer available. Pick another.');
  if (input.existing.some((a) => a.accountId === input.accountId && a.status === 'upcoming' && a.startsAt === start.toISOString())) {
    fail(409, 'double_booking', 'You already have an appointment at that time.');
  }
  return { id: input.id, accountId: input.accountId, locationId: loc.id, serviceId: input.serviceId, date, time, startsAt: start.toISOString(), status: 'upcoming', reference: input.reference, createdAt: input.now.toISOString() };
}

export function cancelAppointment(a: Appointment): Appointment {
  if (a.status !== 'upcoming') fail(409, 'not_cancellable', `Appointment is ${a.status}`);
  a.status = 'cancelled';
  return a;
}

/** Check-in opens 30 minutes before the start and closes 15 minutes after. */
export function checkInWindow(a: Appointment): { opensAt: number; closesAt: number } {
  const t = Date.parse(a.startsAt);
  return { opensAt: t - 30 * 60_000, closesAt: t + 15 * 60_000 };
}

export function checkIn(a: Appointment, now: Date): Appointment {
  if (a.status !== 'upcoming') fail(409, 'not_checkable', `Appointment is ${a.status}`);
  const w = checkInWindow(a);
  if (now.getTime() < w.opensAt) fail(409, 'too_early', 'Check-in opens 30 minutes before your appointment.');
  if (now.getTime() > w.closesAt) fail(409, 'too_late', 'The check-in window has closed. Book a new time.');
  const loc = LOCATIONS.find((l) => l.id === a.locationId)!;
  const n = (hash(a.id) % 90) + 10;
  a.status = 'checked_in';
  a.ticket = { number: `${loc.orgId === 'drivetest' ? 'D' : 'S'}-${String(n).padStart(3, '0')}`, issuedAt: now.toISOString(), peopleAhead: hash(`${a.id}q`) % 5 };
  return a;
}

/** Past appointments become completed (or stay cancelled). */
export function appointmentView(a: Appointment, now: Date): Appointment {
  if ((a.status === 'upcoming' || a.status === 'checked_in') && Date.parse(a.startsAt) + 60 * 60_000 < now.getTime()) {
    return { ...a, status: 'completed' };
  }
  return a;
}

// ---------------------------------------------------------------------------
// Consents: third parties asking to read the user's data
// ---------------------------------------------------------------------------

export type ConsentStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface Consent {
  id: string;
  accountId: string;
  requester: string;
  requesterKind: L;
  /** What will be shared. */
  data: L;
  purpose: L;
  requestedAt: string;
  decidedAt?: string;
  expiresAt: string;
  status: ConsentStatus;
}

export function consentView(c: Consent, now: Date): Consent & { expired: boolean } {
  return { ...c, expired: Date.parse(c.expiresAt) < now.getTime() };
}

export function decideConsent(c: Consent, action: 'approve' | 'reject' | 'revoke', now: Date): Consent {
  if (Date.parse(c.expiresAt) < now.getTime()) fail(409, 'consent_expired', 'This request has expired.');
  if (action === 'revoke') {
    if (c.status !== 'approved') fail(409, 'not_revocable', `Consent is ${c.status}`);
    c.status = 'revoked';
  } else {
    if (c.status !== 'pending') fail(409, 'already_decided', `Consent is ${c.status}`);
    c.status = action === 'approve' ? 'approved' : 'rejected';
  }
  c.decidedAt = now.toISOString();
  return c;
}

/** Example consent requests for a new account (fictional companies). */
export function sampleConsents(accountId: string, now: Date, newId: (p: string) => string): Consent[] {
  const at = (d: number) => new Date(now.getTime() + d * DAY).toISOString();
  return [
    {
      id: newId('cns'), accountId, requester: 'Example Car Rentals Inc.', requesterKind: { en: 'Car rental company', fr: 'Entreprise de location d’autos' },
      data: { en: 'Licence status, class and expiry date', fr: 'Statut, catégorie et date d’expiration du permis' },
      purpose: { en: 'Confirm you can drive a rental vehicle', fr: 'Confirmer que vous pouvez conduire un véhicule de location' },
      requestedAt: at(-0.1), expiresAt: at(2), status: 'pending',
    },
    {
      id: newId('cns'), accountId, requester: 'Sample Insurance Co.', requesterKind: { en: 'Insurance company', fr: 'Compagnie d’assurance' },
      data: { en: 'Driver record: convictions and demerit points (3 years)', fr: 'Dossier de conduite : condamnations et points d’inaptitude (3 ans)' },
      purpose: { en: 'Price your auto insurance renewal', fr: 'Établir le prix du renouvellement de votre assurance auto' },
      requestedAt: at(-40), decidedAt: at(-39), expiresAt: at(325), status: 'approved',
    },
    {
      id: newId('cns'), accountId, requester: 'Placeholder Property Management', requesterKind: { en: 'Landlord', fr: 'Propriétaire' },
      data: { en: 'Name and photo', fr: 'Nom et photo' },
      purpose: { en: 'Confirm your identity for a lease', fr: 'Confirmer votre identité pour un bail' },
      requestedAt: at(-120), decidedAt: at(-90), expiresAt: at(-30), status: 'revoked',
    },
  ];
}

// ---------------------------------------------------------------------------
// Personalized plates (Sanad: "distinguished numbers")
// ---------------------------------------------------------------------------

export const PLATE_FEE = 400; // placeholder
export const PLATE_FEE_BREAKDOWN = [
  { label: { en: 'Personalized plates (pair)', fr: 'Plaques personnalisées (paire)' }, amount: 390 },
  { label: { en: 'Plate registration', fr: 'Inscription de la plaque' }, amount: 10 },
];

const RESERVED_WORDS = ['POLICE', 'OPP', 'RCMP', 'SHERIFF', 'TAXI', 'GOVT', 'MTO', 'CROWN'];
const ISSUED = ['CVPS123', 'DEMO456', '7AB12', 'HELLO', 'FAST', 'LUCKY7', 'MAPLE', 'ONTARIO1', 'TORONTO', 'CANADA'];

export interface PlateCheck {
  plate: string;
  available: boolean;
  reason?: L;
  fee: number;
  feeBreakdown: { label: L; amount: number }[];
  suggestions: string[];
}

export function normalizePlateText(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function plateProblem(plate: string, taken: Set<string>): L | undefined {
  const compact = plate.replace(/ /g, '');
  if (compact.length < 2 || compact.length > 8) return { en: 'Use 2 to 8 letters or numbers.', fr: 'Utilisez de 2 à 8 lettres ou chiffres.' };
  if (!/[A-Z]/.test(compact)) return { en: 'Include at least one letter.', fr: 'Incluez au moins une lettre.' };
  if (/^[A-Z]{4}[0-9]{3}$/.test(compact)) return { en: 'This matches the standard plate format, which is reserved.', fr: 'Ce format est réservé aux plaques ordinaires.' };
  if (RESERVED_WORDS.some((w) => compact.includes(w))) return { en: 'This combination is reserved.', fr: 'Cette combinaison est réservée.' };
  if (ISSUED.includes(compact) || taken.has(compact)) return { en: 'Already issued to another vehicle.', fr: 'Déjà attribuée à un autre véhicule.' };
  return undefined;
}

export function checkPlate(input: string, taken: Set<string>): PlateCheck {
  const plate = normalizePlateText(input);
  const reason = plateProblem(plate, taken);
  const suggestions: string[] = [];
  if (reason && /[A-Z]/.test(plate)) {
    const base = plate.replace(/ /g, '').slice(0, 7);
    for (const v of [`${base}1`, `${base}2`, `${base.slice(0, 6)}ON`, `MY ${base.slice(0, 5)}`, `${base}X`]) {
      if (suggestions.length < 3 && !plateProblem(normalizePlateText(v), taken)) suggestions.push(normalizePlateText(v));
    }
  }
  return { plate, available: !reason, ...(reason ? { reason } : {}), fee: PLATE_FEE, feeBreakdown: PLATE_FEE_BREAKDOWN, suggestions };
}

// ---------------------------------------------------------------------------
// Account security: password rules, PIN, one-time codes
// ---------------------------------------------------------------------------

export function passwordChecks(pw: string): { key: string; ok: boolean; label: L }[] {
  return [
    { key: 'length', ok: pw.length >= 8 && pw.length <= 30, label: { en: '8 to 30 characters', fr: 'De 8 à 30 caractères' } },
    { key: 'upper', ok: /[A-Z]/.test(pw), label: { en: 'An uppercase letter (A–Z)', fr: 'Une majuscule (A–Z)' } },
    { key: 'lower', ok: /[a-z]/.test(pw), label: { en: 'A lowercase letter (a–z)', fr: 'Une minuscule (a–z)' } },
    { key: 'number', ok: /[0-9]/.test(pw), label: { en: 'A number (0–9)', fr: 'Un chiffre (0–9)' } },
    { key: 'special', ok: /[^A-Za-z0-9\s]/.test(pw), label: { en: 'A symbol such as ! @ # $ %', fr: 'Un symbole comme ! @ # $ %' } },
    { key: 'spaces', ok: pw.length > 0 && !/\s/.test(pw), label: { en: 'No spaces', fr: 'Aucune espace' } },
  ];
}

export const passwordOk = (pw: string) => passwordChecks(pw).every((c) => c.ok);

export function assertPassword(pw: string): void {
  if (!passwordOk(pw)) fail(400, 'weak_password', 'The password does not meet the requirements.');
}

/** Digital ID PIN: 4 digits, not all the same, not a simple sequence. */
export function pinProblem(pin: string): string | undefined {
  if (!/^\d{4}$/.test(pin)) return 'The PIN must be 4 digits.';
  if (/^(\d)\1{3}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Choose a PIN that is harder to guess.';
  return undefined;
}

export function assertPin(pin: string): void {
  const p = pinProblem(pin);
  if (p) fail(400, 'weak_pin', p);
}

export interface Otp {
  id: string;
  target: string;
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

export function issueOtp(id: string, target: string, code: string, now: Date): Otp {
  return { id, target, code, expiresAt: now.getTime() + 10 * 60_000, attempts: 0, verified: false };
}

export function verifyOtp(otp: Otp | undefined, code: string, now: Date): void {
  if (!otp) return fail(404, 'otp_not_found', 'Request a new code.');
  if (otp.expiresAt < now.getTime()) fail(410, 'otp_expired', 'The code has expired. Request a new one.');
  if (otp.attempts >= 5) fail(429, 'otp_locked', 'Too many attempts. Request a new code.');
  otp.attempts++;
  if (otp.code !== code.trim()) fail(422, 'otp_invalid', 'The code is incorrect.');
  otp.verified = true;
}

/** "•••• 0100" from a phone number. */
export const phoneHint = (phone?: string) => (phone ? `•••• ${phone.replace(/\D/g, '').slice(-4)}` : '••••');

export const samePhone = (a: string, b?: string) => !!b && a.replace(/\D/g, '').slice(-10) === b.replace(/\D/g, '').slice(-10);

// ---------------------------------------------------------------------------
// Dashboard: things that need the user's attention
// ---------------------------------------------------------------------------

export interface DashboardAction {
  kind: 'renew_document' | 'renew_plate' | 'overdue_ticket' | 'request_action' | 'request_payment' | 'consent' | 'check_in';
  id: string;
  title: L;
  subtitle: L;
  link: string;
  tone: 'danger' | 'warning' | 'info';
  days?: number;
}

const DOC_NAMES: Record<string, L> = {
  driver_licence: { en: "driver's licence", fr: 'permis de conduire' },
  health_card: { en: 'health card', fr: 'carte santé' },
  photo_card: { en: 'photo card', fr: 'carte-photo' },
};

export function dashboardActions(input: {
  now: Date;
  credentials: { id: string; type: string; expiresOn: string }[];
  vehicles: { id: string; plate: string; plateValidationExpires: string }[];
  overdueTickets: number;
  requests: ServiceRequest[];
  consents: Consent[];
  appointments: Appointment[];
}): DashboardAction[] {
  const out: DashboardAction[] = [];
  const days = (iso: string) => Math.ceil((Date.parse(iso) - input.now.getTime()) / DAY);
  if (input.overdueTickets > 0) {
    out.push({
      kind: 'overdue_ticket', id: 'overdue', tone: 'danger', link: '/fines',
      title: { en: `${input.overdueTickets} overdue ticket${input.overdueTickets > 1 ? 's' : ''}`, fr: `${input.overdueTickets} contravention${input.overdueTickets > 1 ? 's' : ''} en retard` },
      subtitle: { en: 'Pay now to avoid a plate renewal denial', fr: 'Payez maintenant pour éviter un refus de renouvellement de plaque' },
    });
  }
  for (const a of input.appointments) {
    const w = checkInWindow(a);
    if (a.status === 'upcoming' && input.now.getTime() >= w.opensAt - 30 * 60_000 && input.now.getTime() <= w.closesAt) {
      out.push({ kind: 'check_in', id: a.id, tone: 'info', link: `/appointments/${a.id}`, title: { en: `Appointment at ${a.time}`, fr: `Rendez-vous à ${a.time}` }, subtitle: { en: 'Check in when you arrive to get your queue ticket', fr: 'Enregistrez-vous à votre arrivée pour obtenir votre billet' } });
    }
  }
  for (const r of input.requests) {
    const name = serviceById(r.serviceId)?.name ?? { en: r.serviceId, fr: r.serviceId };
    if (r.status === 'action_required') out.push({ kind: 'request_action', id: r.id, tone: 'warning', link: `/requests/${r.id}`, title: { en: `${name.en}: action required`, fr: `${name.fr} : action requise` }, subtitle: r.note ?? { en: 'Open the request to see what’s needed', fr: 'Ouvrez la demande pour voir ce qu’il faut' } });
    if (r.status === 'awaiting_payment') out.push({ kind: 'request_payment', id: r.id, tone: 'warning', link: `/requests/${r.id}`, title: { en: `${name.en}: awaiting payment`, fr: `${name.fr} : paiement attendu` }, subtitle: { en: 'Pay to continue processing', fr: 'Payez pour poursuivre le traitement' } });
  }
  for (const c of input.consents) {
    if (c.status === 'pending' && Date.parse(c.expiresAt) > input.now.getTime()) {
      out.push({ kind: 'consent', id: c.id, tone: 'info', link: '/consents', title: { en: `${c.requester} is asking for your data`, fr: `${c.requester} demande vos données` }, subtitle: c.data });
    }
  }
  for (const c of input.credentials) {
    const name = DOC_NAMES[c.type];
    const d = days(c.expiresOn);
    if (!name || d > 60) continue;
    out.push({
      kind: 'renew_document', id: c.id, tone: d < 0 ? 'danger' : 'warning', days: d, link: c.type === 'driver_licence' ? '/services/renew-licence' : c.type === 'health_card' ? '/services/renew-health-card' : `/credential/${c.id}`,
      title: { en: `Renew your ${name.en}`, fr: `Renouvelez votre ${name.fr}` },
      subtitle: d < 0 ? { en: 'Expired', fr: 'Expiré' } : { en: `Expires in ${d} days`, fr: `Expire dans ${d} jours` },
    });
  }
  for (const v of input.vehicles) {
    const d = days(v.plateValidationExpires);
    if (d > 60) continue;
    out.push({ kind: 'renew_plate', id: v.id, tone: d < 0 ? 'danger' : 'warning', days: d, link: `/vehicle/${v.id}`, title: { en: `Renew plate ${v.plate}`, fr: `Renouvelez la plaque ${v.plate}` }, subtitle: d < 0 ? { en: 'Expired', fr: 'Expirée' } : { en: `Expires in ${d} days`, fr: `Expire dans ${d} jours` } });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Help centre
// ---------------------------------------------------------------------------

export interface Faq {
  id: string;
  topic: 'account' | 'documents' | 'tickets' | 'payments' | 'services' | 'privacy';
  q: L;
  a: L;
}

export const FAQ: Faq[] = [
  { id: 'what', topic: 'account', q: { en: 'What is CivicPass?', fr: 'Qu’est-ce que CivicPass?' }, a: { en: 'One app for your driver’s licence, vehicle permits and health card, tickets linked to your plates, and government services: apply, pay, book visits, sign documents and track requests without visiting an office in most cases.', fr: 'Une seule application pour votre permis de conduire, vos certificats d’immatriculation et votre carte santé, les contraventions liées à vos plaques et les services gouvernementaux : demander, payer, prendre rendez-vous, signer des documents et suivre vos demandes, le plus souvent sans vous déplacer.' } },
  { id: 'who', topic: 'account', q: { en: 'Who can use it?', fr: 'Qui peut l’utiliser?' }, a: { en: 'Anyone with an Ontario driver’s licence or photo card can create an account. Without one, you can still use it as a guest to browse services, find locations, read help and verify someone else’s QR code.', fr: 'Toute personne ayant un permis de conduire ou une carte-photo de l’Ontario peut créer un compte. Sinon, vous pouvez l’utiliser comme invité pour parcourir les services, trouver un bureau, lire l’aide et vérifier le code QR de quelqu’un.' } },
  { id: 'cost', topic: 'account', q: { en: 'Is it free?', fr: 'Est-ce gratuit?' }, a: { en: 'The app is free. Some services carry the same government fee as at a counter.', fr: 'L’application est gratuite. Certains services comportent les mêmes frais qu’au comptoir.' } },
  { id: 'create', topic: 'account', q: { en: 'How do I create an account?', fr: 'Comment créer un compte?' }, a: { en: 'Choose Create an account, enter your licence number and date of birth, scan your card and take a selfie, confirm your mobile number with a code, then set a password and a 4-digit digital ID PIN.', fr: 'Choisissez Créer un compte, entrez votre numéro de permis et votre date de naissance, numérisez votre carte et prenez un égoportrait, confirmez votre numéro de cellulaire avec un code, puis choisissez un mot de passe et un NIP d’identité numérique à 4 chiffres.' } },
  { id: 'forgot', topic: 'account', q: { en: 'I forgot my password', fr: 'J’ai oublié mon mot de passe' }, a: { en: 'On the sign-in screen choose Forgot password, enter your email or licence number, confirm your mobile number, enter the code we text you and set a new password.', fr: 'À l’écran de connexion, choisissez Mot de passe oublié, entrez votre courriel ou numéro de permis, confirmez votre numéro de cellulaire, entrez le code reçu par texto et choisissez un nouveau mot de passe.' } },
  { id: 'pin', topic: 'account', q: { en: 'What is the digital ID PIN?', fr: 'Qu’est-ce que le NIP d’identité numérique?' }, a: { en: 'A 4-digit code that confirms it’s really you when you sign a document or share your data with a company. You can change it under Account.', fr: 'Un code à 4 chiffres qui confirme que c’est bien vous quand vous signez un document ou partagez vos données avec une entreprise. Vous pouvez le changer sous Compte.' } },
  { id: 'valid', topic: 'documents', q: { en: 'Is the digital licence accepted?', fr: 'Le permis numérique est-il accepté?' }, a: { en: 'Not yet. This is a prototype; recognition of a digital licence needs a change in the law (Jordan did this in 2026). Carry your physical card.', fr: 'Pas encore. Il s’agit d’un prototype; la reconnaissance d’un permis numérique exige une modification de la loi (la Jordanie l’a fait en 2026). Ayez votre carte sur vous.' } },
  { id: 'show', topic: 'documents', q: { en: 'How do I show my licence?', fr: 'Comment présenter mon permis?' }, a: { en: 'Open the document and choose what to share: everything, only that you’re over 19, or only your name and photo. The QR code is signed and expires after 90 seconds.', fr: 'Ouvrez le document et choisissez quoi partager : tout, seulement que vous avez plus de 19 ans, ou seulement votre nom et votre photo. Le code QR est signé et expire après 90 secondes.' } },
  { id: 'wrong', topic: 'documents', q: { en: 'Something on my document is wrong', fr: 'Une information de mon document est erronée' }, a: { en: 'Open the document, choose Request a correction, select what’s wrong and describe the fix. Track it in My requests.', fr: 'Ouvrez le document, choisissez Demander une correction, sélectionnez l’erreur et décrivez la correction. Suivez-la dans Mes demandes.' } },
  { id: 'camera', topic: 'tickets', q: { en: 'Why did a camera ticket appear in my account?', fr: 'Pourquoi une contravention de caméra apparaît-elle dans mon compte?' }, a: { en: 'Red light and speed camera tickets are issued to the vehicle’s registered owner. When a camera records one of your plates, the ticket is linked to your account automatically. No demerit points apply. The notice is still mailed.', fr: 'Les contraventions de caméras de feu rouge et de vitesse sont adressées au propriétaire inscrit du véhicule. Lorsqu’une caméra capte une de vos plaques, la contravention est liée à votre compte automatiquement. Aucun point d’inaptitude. L’avis est quand même posté.' } },
  { id: 'dispute', topic: 'tickets', q: { en: 'Can I dispute a ticket?', fr: 'Puis-je contester une contravention?' }, a: { en: 'Yes, within 15 days: request a meeting with a prosecutor or a trial, right from the ticket.', fr: 'Oui, dans les 15 jours : demandez une rencontre avec un procureur ou un procès, directement à partir de la contravention.' } },
  { id: 'payfail', topic: 'payments', q: { en: 'My payment failed', fr: 'Mon paiement a échoué' }, a: { en: 'Nothing was charged. Try again, check your card balance or use another method. Every attempt is listed in Payment history.', fr: 'Rien n’a été prélevé. Réessayez, vérifiez le solde de votre carte ou utilisez un autre mode. Chaque tentative figure dans l’historique des paiements.' } },
  { id: 'receipt', topic: 'payments', q: { en: 'Where are my receipts?', fr: 'Où sont mes reçus?' }, a: { en: 'Account → Payment history. Each payment has a receipt number, payment number and method.', fr: 'Compte → Historique des paiements. Chaque paiement a un numéro de reçu, un numéro de paiement et un mode.' } },
  { id: 'status', topic: 'services', q: { en: 'What do request statuses mean?', fr: 'Que signifient les statuts des demandes?' }, a: { en: 'In review: being processed. Awaiting payment: pay to continue. Action required: correct or add information and resubmit. Completed, Rejected or Cancelled: closed.', fr: 'En traitement : en cours. Paiement attendu : payez pour continuer. Action requise : corrigez ou ajoutez l’information et soumettez de nouveau. Terminée, refusée ou annulée : fermée.' } },
  { id: 'visit', topic: 'services', q: { en: 'Do I ever need to visit an office?', fr: 'Dois-je parfois me rendre dans un bureau?' }, a: { en: 'Some steps need you in person, like a vision test or a new photo. Book the visit in the app, then check in on arrival to get your queue ticket.', fr: 'Certaines étapes exigent votre présence, comme l’examen de la vue ou une nouvelle photo. Prenez rendez-vous dans l’application, puis enregistrez-vous à votre arrivée pour obtenir votre billet.' } },
  { id: 'consents', topic: 'privacy', q: { en: 'What are data requests?', fr: 'Que sont les demandes de données?' }, a: { en: 'Companies such as insurers or car rentals can ask to read specific information. Nothing is shared until you approve with your PIN, and you can revoke at any time.', fr: 'Des entreprises comme des assureurs ou des agences de location peuvent demander à consulter certains renseignements. Rien n’est partagé avant votre approbation avec votre NIP, et vous pouvez révoquer en tout temps.' } },
  { id: 'lost', topic: 'privacy', q: { en: 'I lost my phone', fr: 'J’ai perdu mon téléphone' }, a: { en: 'Sign in on another device and choose Account → Lost your phone. Every QR code shown before then stops working.', fr: 'Connectez-vous sur un autre appareil et choisissez Compte → Téléphone perdu. Tous les codes QR affichés auparavant cessent de fonctionner.' } },
];

export const FEEDBACK_TOPICS: { id: string; label: L }[] = [
  { id: 'documents', label: { en: 'Documents', fr: 'Documents' } },
  { id: 'tickets', label: { en: 'Tickets', fr: 'Contraventions' } },
  { id: 'payments', label: { en: 'Payments', fr: 'Paiements' } },
  { id: 'services', label: { en: 'Government services', fr: 'Services gouvernementaux' } },
  { id: 'signature', label: { en: 'Digital signature', fr: 'Signature numérique' } },
  { id: 'appointments', label: { en: 'Appointments and locations', fr: 'Rendez-vous et bureaux' } },
  { id: 'other', label: { en: 'Other', fr: 'Autre' } },
];

export const IMPROVEMENT_AREAS: { id: string; label: L }[] = [
  { id: 'signin', label: { en: 'Sign-in and registration', fr: 'Connexion et inscription' } },
  { id: 'ease', label: { en: 'Ease of use', fr: 'Facilité d’utilisation' } },
  { id: 'speed', label: { en: 'App speed', fr: 'Rapidité' } },
  { id: 'clarity', label: { en: 'Clear information', fr: 'Clarté de l’information' } },
  { id: 'support', label: { en: 'Support', fr: 'Soutien' } },
];

export interface Feedback {
  id: string;
  accountId?: string;
  kind: 'suggestion' | 'complaint' | 'rating' | 'new_service';
  topic?: string;
  message?: string;
  rating?: number;
  improvements?: string[];
  reference: string;
  createdAt: string;
}

export function validateFeedback(f: Pick<Feedback, 'kind' | 'message' | 'rating' | 'topic'>): void {
  if (f.kind === 'rating') {
    if (!f.rating || f.rating < 1 || f.rating > 5) fail(400, 'validation_error', 'Choose a rating from 1 to 5.');
    return;
  }
  const len = (f.message ?? '').trim().length;
  if (len < 10) fail(400, 'validation_error', 'Tell us a bit more (at least 10 characters).');
  if (len > 1000) fail(400, 'validation_error', 'Keep it under 1,000 characters.');
  if ((f.kind === 'suggestion' || f.kind === 'complaint') && !f.topic) fail(400, 'validation_error', 'Choose a topic.');
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export const MAX_FAVOURITE_CARDS = 5;
export const MAX_FAVOURITE_SERVICES = 8;

export interface Preferences {
  favouriteCards: string[];
  favouriteServices: string[];
  notifications: { renewals: boolean; tickets: boolean; requests: boolean };
}

export const defaultPreferences = (): Preferences => ({
  favouriteCards: [],
  favouriteServices: ['renew-licence', 'renew-plate', 'pay-ticket', 'driver-record'],
  notifications: { renewals: true, tickets: true, requests: true },
});

export function mergePreferences(p: Preferences, patch: Partial<Preferences>): Preferences {
  const next = { ...p, ...patch, notifications: { ...p.notifications, ...(patch.notifications ?? {}) } };
  if (next.favouriteCards.length > MAX_FAVOURITE_CARDS) fail(400, 'too_many_favourites', `Choose up to ${MAX_FAVOURITE_CARDS} cards.`);
  if (next.favouriteServices.length > MAX_FAVOURITE_SERVICES) fail(400, 'too_many_favourites', `Choose up to ${MAX_FAVOURITE_SERVICES} services.`);
  if (next.favouriteServices.some((id) => !serviceById(id))) fail(400, 'unknown_service', 'Unknown service.');
  next.favouriteCards = [...new Set(next.favouriteCards)];
  next.favouriteServices = [...new Set(next.favouriteServices)];
  return next;
}

// ---------------------------------------------------------------------------
// Saved payment cards
// ---------------------------------------------------------------------------

export interface SavedCard {
  id: string;
  accountId: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'card';
  last4: string;
  expiry: string;
  addedAt: string;
}

export function cardBrand(number: string): SavedCard['brand'] {
  const n = number.replace(/\D/g, '');
  if (n.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'card';
}

// ---------------------------------------------------------------------------
// Signing (Sanad "My Signature")
// ---------------------------------------------------------------------------

/** Signed copies are deleted from the server after this many days; the hash stays. */
export const SIGNED_RETENTION_DAYS = 7;

export const SIGNABLE_DOCUMENTS: { id: string; title: L; content: string }[] = [
  {
    id: 'bill-of-sale',
    title: { en: 'Vehicle bill of sale (sample)', fr: 'Acte de vente de véhicule (exemple)' },
    content: ['BILL OF SALE — SAMPLE', 'Seller: the account holder.', 'Buyer: licence L4321-09876-50302.', 'Vehicle: 2021 Honda Civic, VIN 1HGCV1F30LA000001.', 'Sale price: $18,500.00 CAD. Sold as-is.', 'Both parties confirm the information above is true.'].join('\n'),
  },
  {
    id: 'authorization',
    title: { en: 'Authorization to act on my behalf (sample)', fr: 'Autorisation d’agir en mon nom (exemple)' },
    content: ['AUTHORIZATION — SAMPLE', 'I authorize Sam Example (licence L4321-09876-50302)', 'to renew the plate validation for my vehicle CVPS 123', 'at a ServiceOntario centre on my behalf.', 'Valid for 30 days from the date of signature.'].join('\n'),
  },
];

// ---------------------------------------------------------------------------
// Request results and sample data
// ---------------------------------------------------------------------------

export function driverRecordResult(input: {
  licenceNumber: string;
  licenceClass?: string;
  status: string;
  expiresOn: string;
  convictions: { date: string; offence: string; points: number }[];
  period: string;
}): ServiceRequest['result'] {
  const points = input.convictions.reduce((s, c) => s + c.points, 0);
  return {
    title: { en: 'Driver record (certified abstract)', fr: 'Dossier de conduite (relevé certifié)' },
    lines: [
      { label: { en: 'Licence number', fr: 'Numéro de permis' }, value: input.licenceNumber },
      { label: { en: 'Class', fr: 'Catégorie' }, value: input.licenceClass ?? '—' },
      { label: { en: 'Status', fr: 'Statut' }, value: input.status.toUpperCase() },
      { label: { en: 'Expires', fr: 'Expiration' }, value: input.expiresOn },
      { label: { en: 'Period', fr: 'Période' }, value: input.period },
      { label: { en: 'Demerit points', fr: 'Points d’inaptitude' }, value: String(points) },
      ...(input.convictions.length
        ? input.convictions.map((c) => ({ label: { en: `Conviction ${c.date}`, fr: `Condamnation ${c.date}` }, value: `${c.offence} (${c.points} pts)` }))
        : [{ label: { en: 'Convictions', fr: 'Condamnations' }, value: 'None / Aucune' }]),
    ],
  };
}

export function vehicleHistoryResult(vin: string): ServiceRequest['result'] {
  const h = hash(vin.toUpperCase());
  const year = 2015 + (h % 8);
  return {
    title: { en: 'Used vehicle history report (sample data)', fr: 'Rapport d’historique de véhicule (données fictives)' },
    lines: [
      { label: { en: 'VIN', fr: 'NIV' }, value: vin.toUpperCase() },
      { label: { en: 'First registered in Ontario', fr: 'Première immatriculation en Ontario' }, value: String(year) },
      { label: { en: 'Previous owners', fr: 'Propriétaires précédents' }, value: String(1 + (h % 3)) },
      { label: { en: 'Liens registered', fr: 'Privilèges enregistrés' }, value: h % 5 === 0 ? 'Yes / Oui' : 'None / Aucun' },
      { label: { en: 'Last odometer reading', fr: 'Dernier relevé d’odomètre' }, value: `${(40_000 + (h % 120_000)).toLocaleString('en-CA')} km` },
      { label: { en: 'Branding', fr: 'Marque de statut' }, value: 'None / Aucune' },
    ],
  };
}

/** Requests in different states, so "My requests" shows the full lifecycle. */
export function sampleRequests(accountId: string, now: Date, newId: (p: string) => string, ref: (p: string) => string): ServiceRequest[] {
  const at = (d: number) => new Date(now.getTime() + d * DAY);
  const record = createRequest({ id: newId('req'), reference: ref('SR'), accountId, service: serviceById('driver-record')!, data: { years: '3 years' }, paymentId: 'pay_hist_2', now: at(-12) });
  record.result = driverRecordResult({ licenceNumber: 'T7654-32109-80514', licenceClass: 'G, M', status: 'valid', expiresOn: '2027-05-14', convictions: [], period: '3 years' });
  const parking = createRequest({ id: newId('req'), reference: ref('SR'), accountId, service: serviceById('accessible-parking')!, data: { practitioner: 'Dr. Example' }, now: at(-5) });
  requireAction(parking, { en: 'The practitioner’s registration number is missing. Add it and resubmit.', fr: 'Le numéro d’inscription du praticien manque. Ajoutez-le et soumettez de nouveau.' }, at(-2));
  const birth = createRequest({ id: newId('req'), reference: ref('SR'), accountId, service: serviceById('birth-certificate')!, data: { form: 'Long form', purpose: 'Passport' }, paymentId: 'pay_hist_3', now: at(-1) });
  return [record, parking, birth];
}

/** An appointment that starts 20 minutes from now, so check-in can be shown. */
export function sampleAppointment(accountId: string, now: Date, newId: (p: string) => string, ref: (p: string) => string): Appointment {
  const start = new Date(Math.ceil((now.getTime() + 20 * 60_000) / 300_000) * 300_000);
  const { date, time } = ontarioClock(start);
  return { id: newId('apt'), accountId, locationId: 'loc_tor_drive', serviceId: 'vision-test', date, time, startsAt: start.toISOString(), status: 'upcoming', reference: ref('APT'), createdAt: new Date(now.getTime() - 2 * DAY).toISOString() };
}
