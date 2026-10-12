import { Card, Screen, Txt } from '../../components/ui';
import { APP_NAME } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { space } from '../../lib/theme';

export default function About() {
  const { tr } = useI18n();
  return (
    <Screen>
      <Txt v="title">{APP_NAME}</Txt>
      <Txt v="body">
        {tr(
          'One sign-in for your digital documents and government services: carry your driver’s licence, vehicle permits and health card; see camera and parking tickets linked to your plates; apply, pay, book visits, sign documents and track every request.',
          'Une seule connexion pour vos documents numériques et services gouvernementaux : vos permis, certificats d’immatriculation et carte santé; les contraventions de caméra et de stationnement liées à vos plaques; demandes, paiements, rendez-vous, signatures et suivi de chaque demande.',
        )}
      </Txt>
      <Card style={{ gap: space.sm }}>
        <Txt v="label" muted>
          {tr('Inspired by', 'Inspiré de')}
        </Txt>
        <Txt v="callout">
          {tr(
            'Jordan’s Sanad platform: about 2.6 million activated digital IDs and 500+ services, with a digital ID made legally equal to the physical card in 2026.',
            'La plateforme Sanad de la Jordanie : environ 2,6 millions d’identités numériques activées et plus de 500 services, avec une identité numérique ayant la même valeur légale que la carte depuis 2026.',
          )}
        </Txt>
      </Card>
      <Txt v="caption" faint>
        {tr('Prototype. Not a government app; documents shown are specimens.', 'Prototype. Ce n’est pas une application gouvernementale; les documents affichés sont des spécimens.')}
      </Txt>
    </Screen>
  );
}
