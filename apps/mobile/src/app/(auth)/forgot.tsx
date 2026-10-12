import { useState } from 'react';
import { router } from 'expo-router';
import { PasswordRules, ResultPanel, Steps } from '../../components/kit';
import { Button, Card, Field, Notice, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { passwordOk } from '../../lib/shared/platform';
import { space } from '../../lib/theme';

/** Forgot password (Sanad): ID → confirm phone → code → new password. */
export default function Forgot() {
  const { tr } = useI18n();
  const [step, setStep] = useState(0);
  const [identifier, setIdentifier] = useState('');
  const [reset, setReset] = useState<{ resetId: string; phoneHint: string }>();
  const [phone, setPhone] = useState('');
  const [devCode, setDevCode] = useState<string>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const steps = [tr('Account', 'Compte'), tr('Mobile', 'Cellulaire'), tr('Code', 'Code'), tr('New password', 'Nouveau mot de passe')];

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 4) {
    return (
      <Screen>
        <ResultPanel title={tr('Password changed', 'Mot de passe modifié')} subtitle={tr('Sign in with your new password.', 'Connectez-vous avec votre nouveau mot de passe.')} />
        <Button title={tr('Back to sign in', 'Retour à la connexion')} onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Steps steps={steps} current={step} />
      {error && <Notice tone="danger">{error}</Notice>}
      {step === 0 && (
        <>
          <Txt v="body" muted>
            {tr('Reset your password by confirming the mobile number on your account.', 'Réinitialisez votre mot de passe en confirmant le cellulaire de votre compte.')}
          </Txt>
          <Field label={tr('Email or licence number', 'Courriel ou numéro de permis')} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
          <Button title={tr('Next', 'Suivant')} loading={busy} disabled={identifier.trim().length < 3} onPress={() => void run(async () => { setReset(await api.resetStart(identifier.trim())); setStep(1); })} />
        </>
      )}
      {step === 1 && reset && (
        <>
          <Txt v="body" muted>
            {tr(`Enter the mobile number on your account, ending in ${reset.phoneHint.slice(-4)}.`, `Entrez le cellulaire de votre compte, se terminant par ${reset.phoneHint.slice(-4)}.`)}
          </Txt>
          <Field label={tr('Mobile number', 'Cellulaire')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Txt v="caption" muted>
            {tr('Lost access to that number? Visit a ServiceOntario centre with photo ID.', 'Vous n’avez plus ce numéro? Rendez-vous dans un centre ServiceOntario avec une pièce d’identité.')}
          </Txt>
          <Button title={tr('Send code', 'Envoyer le code')} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} onPress={() => void run(async () => { setDevCode((await api.resetPhone(reset.resetId, phone)).devCode); setStep(2); })} />
        </>
      )}
      {step === 2 && reset && (
        <>
          <Txt v="body" muted>
            {tr(`We texted a code to ${reset.phoneHint}.`, `Nous avons envoyé un code au ${reset.phoneHint}.`)}
          </Txt>
          <Field label={tr('6-digit code', 'Code à 6 chiffres')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" />
          {devCode && (
            <Txt v="caption" faint>
              {tr(`No SMS in this prototype. Your code: ${devCode}`, `Pas de texto dans ce prototype. Votre code : ${devCode}`)}
            </Txt>
          )}
          <Button title={tr('Verify', 'Vérifier')} loading={busy} disabled={code.length !== 6} onPress={() => void run(async () => { await api.resetVerify(reset.resetId, code); setStep(3); })} />
          <Button title={tr('Resend code', 'Renvoyer le code')} variant="ghost" size="md" onPress={() => void run(async () => setDevCode((await api.resetPhone(reset.resetId, phone)).devCode))} />
        </>
      )}
      {step === 3 && reset && (
        <>
          <Field label={tr('New password', 'Nouveau mot de passe')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <Card style={{ gap: space.sm }}>
            <PasswordRules password={password} />
          </Card>
          <Field label={tr('Confirm new password', 'Confirmer le mot de passe')} value={confirm} onChangeText={setConfirm} secureTextEntry error={confirm && confirm !== password ? tr('Passwords don’t match', 'Les mots de passe ne correspondent pas') : undefined} />
          <Button title={tr('Change password', 'Changer le mot de passe')} loading={busy} disabled={!passwordOk(password) || confirm !== password} onPress={() => void run(async () => { await api.resetComplete(reset.resetId, password); setStep(4); })} />
        </>
      )}
    </Screen>
  );
}
