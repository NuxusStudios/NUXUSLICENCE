import { useState } from 'react';
import { router } from 'expo-router';
import { PinPad, ResultPanel } from '../../components/kit';
import { Button, ErrorState, Loading, Notice, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { pinProblem } from '../../lib/shared/platform';
import { useAsync } from '../../lib/useAsync';

/** Set or change the 4-digit digital ID PIN used to sign and to share data. */
export default function ChangePin() {
  const { tr } = useI18n();
  const me = useAsync(api.me);
  const [stage, setStage] = useState<'current' | 'new' | 'confirm' | 'done'>();
  const [current, setCurrent] = useState<string>();
  const [first, setFirst] = useState<string>();
  if (!me.data && me.loading) return <Loading />;
  if (!me.data && me.error) return <ErrorState error={me.error} onRetry={me.reload} />;
  const pinSet = me.data!.account.pinSet;
  const s = stage ?? (pinSet ? 'current' : 'new');

  if (s === 'done') {
    return (
      <Screen>
        <ResultPanel title={tr('Digital ID PIN saved', 'NIP enregistré')} subtitle={tr('Use it to sign documents and approve data requests.', 'Utilisez-le pour signer des documents et approuver des demandes de données.')} />
        <Button title={tr('Close', 'Fermer')} onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Txt v="callout" muted>
        {tr('Your PIN confirms it’s really you when you sign a document or share your data. Don’t use your birth year or 1234.', 'Votre NIP confirme que c’est bien vous quand vous signez ou partagez vos données. N’utilisez pas votre année de naissance ni 1234.')}
      </Txt>
      {s === 'current' && (
        <PinPad
          key="current"
          title={tr('Enter your current PIN', 'Entrez votre NIP actuel')}
          onComplete={async (pin) => {
            setCurrent(pin);
            setStage('new');
          }}
        />
      )}
      {s === 'new' && (
        <PinPad
          key="new"
          showDemoHint={false}
          title={tr('Choose a new 4-digit PIN', 'Choisissez un nouveau NIP à 4 chiffres')}
          onComplete={async (pin) => {
            const problem = pinProblem(pin);
            if (problem) throw new Error(tr('Choose a PIN that is harder to guess.', 'Choisissez un NIP plus difficile à deviner.'));
            setFirst(pin);
            setStage('confirm');
          }}
        />
      )}
      {s === 'confirm' && (
        <PinPad
          key="confirm"
          showDemoHint={false}
          title={tr('Enter the new PIN again', 'Entrez de nouveau le NIP')}
          onComplete={async (pin) => {
            if (pin !== first) {
              setStage('new');
              throw new Error(tr('The PINs don’t match.', 'Les NIP ne correspondent pas.'));
            }
            try {
              await api.changePin(pin, current);
              setStage('done');
            } catch (e) {
              setStage(pinSet ? 'current' : 'new');
              throw e;
            }
          }}
        />
      )}
      {pinSet && s !== 'current' && <Notice tone="info">{tr('Forgot your PIN? Reset it at a ServiceOntario centre with photo ID.', 'NIP oublié? Réinitialisez-le dans un centre ServiceOntario avec une pièce d’identité.')}</Notice>}
    </Screen>
  );
}
