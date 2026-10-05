import { cardDate } from '../lib/format';
import type { Credential } from '../lib/types';
import { Box, FieldRow, Part, Perforation, Sheet } from './FormSheet';

/**
 * The vehicle permit ("ownership") as a two-part paper document: the plate
 * portion (registrant and plate) and the vehicle portion (the vehicle itself),
 * separated by a perforation, the way the paper permit is issued.
 */
export function VehiclePermitDocument({ credential }: { credential: Credential }) {
  const v = credential.vehicle;
  const h = credential.holder;
  if (!v) return null;
  const address = `${h.address.line1}${h.address.line2 ? `, ${h.address.line2}` : ''}\n${h.address.city} ${h.address.province} ${h.address.postalCode}`;
  return (
    <Sheet title={['VEHICLE PERMIT', "CERTIFICAT D'IMMATRICULATION"]} subtitle={`${credential.documentNumber} · ${v.jurisdiction}`} accent="#0F4F55">
      <Part en="PLATE PORTION" fr="PARTIE PLAQUE" />
      <FieldRow>
        <Box en="PLATE NO" fr="NO DE PLAQUE" value={v.plate} mono strong />
        <Box en="VALIDATION EXP" fr="EXPIRATION" value={cardDate(v.plateValidationExpires)} mono />
      </FieldRow>
      <FieldRow>
        <Box en="REGISTRANT" fr="TITULAIRE" value={`${h.surname.toUpperCase()}, ${h.givenNames.toUpperCase()}`} />
      </FieldRow>
      <FieldRow>
        <Box en="ADDRESS" fr="ADRESSE" value={address.toUpperCase()} />
      </FieldRow>

      <Perforation />

      <Part en="VEHICLE PORTION" fr="PARTIE VÉHICULE" />
      <FieldRow>
        <Box en="VIN" fr="NIV" value={v.vin} mono flex={2} />
        <Box en="YEAR" fr="ANNÉE" value={String(v.year)} mono />
      </FieldRow>
      <FieldRow>
        <Box en="MAKE" fr="MARQUE" value={v.make.toUpperCase()} />
        <Box en="MODEL" fr="MODÈLE" value={v.model.toUpperCase()} />
      </FieldRow>
      <FieldRow>
        <Box en="BODY" fr="CARROSSERIE" value={(v.bodyType ?? '—').toUpperCase()} />
        <Box en="COLOUR" fr="COULEUR" value={v.colour.toUpperCase()} />
      </FieldRow>
      <FieldRow>
        <Box en="REG. DATE" fr="DATE D'IMM." value={cardDate(credential.issuedOn)} mono />
        <Box en="STATUS" fr="STATUT" value={credential.status === 'valid' ? 'VALID / VALIDE' : credential.status.toUpperCase()} />
      </FieldRow>
    </Sheet>
  );
}
