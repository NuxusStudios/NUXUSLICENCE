import { View } from 'react-native';
import { Card, Screen, Txt } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { space } from '../../lib/theme';

export default function Privacy() {
  const { tr } = useI18n();
  const sections: [string, string][] = [
    [tr('What we collect', 'Ce que nous recueillons'), tr('At sign-up: your licence number, date of birth, email and mobile number, plus a document scan and selfie used once to confirm it’s you. The app reads your documents from the issuing ministries; it doesn’t keep its own copy.', 'À l’inscription : numéro de permis, date de naissance, courriel et cellulaire, ainsi qu’une numérisation et un égoportrait utilisés une seule fois pour confirmer votre identité. L’application lit vos documents auprès des ministères émetteurs; elle n’en garde pas de copie.')],
    [tr('Permissions', 'Autorisations'), tr('Camera: to scan QR codes and your card. Notifications: renewal reminders, tickets and request updates. Face ID or fingerprint: optional app lock.', 'Appareil photo : lire des codes QR et votre carte. Notifications : rappels, contraventions et suivi des demandes. Face ID ou empreinte : verrouillage facultatif.')],
    [tr('Sharing', 'Partage'), tr('Only what you choose: each QR code shows only what you picked, and organizations get data only after you approve their request with your PIN. Every check is logged in “Who verified my ID”.', 'Seulement ce que vous choisissez : chaque code QR ne montre que ce que vous avez choisi, et les organismes n’obtiennent des données qu’après votre approbation avec votre NIP. Chaque vérification est consignée.')],
    [tr('Retention', 'Conservation'), tr('Signed documents are deleted from our servers 7 days after signing; the fingerprint (hash) and signature remain as proof.', 'Les documents signés sont supprimés de nos serveurs 7 jours après la signature; l’empreinte et la signature restent comme preuve.')],
    [tr('Your rights', 'Vos droits'), tr('Access and correct your information, revoke data sharing, or close your account. Requests are handled under FIPPA.', 'Accéder à vos renseignements et les corriger, révoquer un partage ou fermer votre compte, conformément à la LAIPVP.')],
  ];
  return (
    <Screen>
      {sections.map(([h, b]) => (
        <Card key={h} style={{ gap: space.xs }}>
          <Txt v="headline">{h}</Txt>
          <Txt v="callout" muted>
            {b}
          </Txt>
        </Card>
      ))}
      <View style={{ height: space.md }} />
    </Screen>
  );
}
