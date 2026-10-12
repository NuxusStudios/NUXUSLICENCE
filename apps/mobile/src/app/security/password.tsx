import { useState } from 'react';
import { router } from 'expo-router';
import { PasswordRules, ResultPanel } from '../../components/kit';
import { Button, Card, Field, Notice, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { passwordOk } from '../../lib/shared/platform';
import { space } from '../../lib/theme';

export default function ChangePassword() {
  const { tr } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <ResultPanel title={tr('Password changed', 'Mot de passe modifié')} />
        <Button title={tr('Close', 'Fermer')} onPress={() => router.back()} />
      </Screen>
    );
  }
  const mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Screen>
      <Field label={tr('Current password', 'Mot de passe actuel')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <Field label={tr('New password', 'Nouveau mot de passe')} value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
      <Card style={{ gap: space.sm }}>
        <PasswordRules password={next} />
      </Card>
      <Field label={tr('Confirm new password', 'Confirmer le nouveau mot de passe')} value={confirm} onChangeText={setConfirm} secureTextEntry error={mismatch ? tr('Passwords don’t match', 'Les mots de passe ne correspondent pas') : undefined} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={tr('Change password', 'Changer le mot de passe')} onPress={submit} loading={busy} disabled={!current || !passwordOk(next) || confirm !== next} />
    </Screen>
  );
}
