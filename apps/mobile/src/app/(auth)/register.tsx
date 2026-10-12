import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PasswordRules, Steps } from '../../components/kit';
import { Button, Card, Field, IconTile, Notice, PressScale, Screen, Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { DEMO_MODE } from '../../lib/config';
import { useI18n } from '../../lib/i18n';
import { passwordOk, pinProblem } from '../../lib/shared/platform';
import { radius, space, useTheme } from '../../lib/theme';

/**
 * Four-step onboarding that replaces Sanad's in-person activation:
 * 1. match licence number + DOB against the registry
 * 2. document scan + liveness selfie through an identity-verification SDK
 * 3. confirm the mobile number with a one-time code
 * 4. account credentials and the digital ID PIN
 */
export default function Register() {
  const { completeRegistration } = useAuth();
  const { t, tr, lang } = useI18n();
  const c = useTheme();
  const [step, setStep] = useState(1);
  const [licenceNumber, setLicence] = useState('');
  const [dateOfBirth, setDob] = useState('');
  const [docScanned, setDocScanned] = useState(false);
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState<{ otpId: string; devCode?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      // The IDV vendor SDK returns a session id after document + liveness checks;
      // the API confirms the result server-to-server before creating the account.
      const idvSessionId = `idv_demo_${Date.now()}`;
      const { accessToken } = await api.register({ email, password, phone, licenceNumber, dateOfBirth, idvSessionId, language: lang, pin, otpId: otp?.otpId, otpCode: code });
      await completeRegistration(accessToken);
    } catch (e) {
      setError((e as Error).message);
      // Identity mismatch → send them back to fix the details.
      const errCode = (e as { code?: string }).code;
      if (errCode === 'identity_not_matched') setStep(1);
      if (errCode?.startsWith('otp_')) setStep(3);
    } finally {
      setBusy(false);
    }
  }

  const header = (title: string, body: string) => (
    <View style={{ gap: space.sm }}>
      <Txt v="title" accessibilityRole="header">
        {title}
      </Txt>
      <Txt v="body" muted>
        {body}
      </Txt>
    </View>
  );

  const capture = ({ done, icon, label, onPress, disabled }: { done: boolean; icon: IconName; label: string; onPress: () => void; disabled?: boolean }) => (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, checked: done }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderStyle: done ? 'solid' : 'dashed',
        borderColor: done ? c.success : c.border,
        backgroundColor: done ? c.successBg : c.surface,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <IconTile icon={done ? 'checkmark' : icon} tone={done ? 'success' : undefined} size={46} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="strong">{label}</Txt>
        {done && (
          <Txt v="caption" color={c.success}>
            {t('scanned')}
          </Txt>
        )}
      </View>
      {!done && <Ionicons name="camera-outline" size={20} color={c.textFaint} />}
    </PressScale>
  );

  return (
    <Screen>
      <Steps steps={[t('regStep1'), t('regStep2'), tr('Your mobile number', 'Votre cellulaire'), t('regStep3')]} current={step - 1} />
      {error && <Notice tone="danger">{error}</Notice>}

      {step === 1 && (
        <>
          {header(t('regStep1'), t('regStep1Body'))}
          <Field label={t('licenceNumber')} value={licenceNumber} onChangeText={setLicence} autoCapitalize="characters" placeholder="A1234-56789-01234" />
          <Field label={t('dateOfBirth')} value={dateOfBirth} onChangeText={setDob} placeholder="1990-01-31" keyboardType="numbers-and-punctuation" />
          <Button title={t('continue')} onPress={() => setStep(2)} disabled={licenceNumber.length < 5 || !dobValid} />
          <Txt v="caption" faint style={{ textAlign: 'center' }}>
            {t('regDemoHint')}
          </Txt>
        </>
      )}

      {step === 2 && (
        <>
          {header(t('regStep2'), t('regStep2Body'))}
          {capture({ done: docScanned, icon: 'card', label: t('scanDocument'), onPress: () => setDocScanned(true) })}
          {capture({ done: selfieTaken, icon: 'happy', label: t('takeSelfie'), onPress: () => setSelfieTaken(true), disabled: !docScanned })}
          <Button title={t('continue')} onPress={() => setStep(3)} disabled={!docScanned || !selfieTaken} />
          <Button title={t('back')} variant="ghost" size="md" onPress={() => setStep(1)} />
        </>
      )}

      {step === 3 && (
        <>
          {header(tr('Your mobile number', 'Votre cellulaire'), tr('We text a code to confirm the number. It’s used to recover your account.', 'Nous envoyons un code par texto pour confirmer le numéro. Il sert à récupérer votre compte.'))}
          <Field label={tr('Mobile number', 'Cellulaire')} value={phone} onChangeText={(v) => { setPhone(v); setOtp(undefined); }} keyboardType="phone-pad" autoComplete="tel" placeholder="+1 416 555 0100" />
          {!otp ? (
            <Button
              title={tr('Send code', 'Envoyer le code')}
              icon="chatbubble-ellipses-outline"
              loading={busy}
              disabled={phone.replace(/\D/g, '').length < 10}
              onPress={async () => {
                setBusy(true);
                setError(undefined);
                try {
                  setOtp(await api.sendOtp(phone));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <>
              <Field label={tr('6-digit code', 'Code à 6 chiffres')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" />
              {(DEMO_MODE || otp.devCode) && (
                <Txt v="caption" faint>
                  {tr(`No SMS in this prototype. Your code: ${otp.devCode}`, `Pas de texto dans ce prototype. Votre code : ${otp.devCode}`)}
                </Txt>
              )}
              <Button title={t('continue')} onPress={() => setStep(4)} disabled={code.length !== 6} />
              <Button title={tr('Resend code', 'Renvoyer le code')} variant="ghost" size="md" onPress={() => { setOtp(undefined); setCode(''); }} />
            </>
          )}
          <Button title={t('back')} variant="ghost" size="md" onPress={() => setStep(2)} />
        </>
      )}

      {step === 4 && (
        <>
          {header(t('regStep3'), t('regStep3Body'))}
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <Card style={{ gap: space.sm }}>
            <PasswordRules password={password} />
          </Card>
          <Field
            label={tr('Digital ID PIN (4 digits)', 'NIP d’identité numérique (4 chiffres)')}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
            secureTextEntry
            keyboardType="number-pad"
            error={pin.length === 4 && pinProblem(pin) ? tr('Choose a PIN that is harder to guess.', 'Choisissez un NIP plus difficile à deviner.') : undefined}
          />
          <Txt v="caption" muted>
            {tr('You’ll use the PIN to sign documents and approve data requests.', 'Le NIP sert à signer des documents et à approuver des demandes de données.')}
          </Txt>
          <Button title={t('createAccount')} onPress={submit} loading={busy} disabled={!email.includes('@') || !passwordOk(password) || !!pinProblem(pin)} />
          <Button title={t('back')} variant="ghost" size="md" onPress={() => setStep(3)} />
        </>
      )}
    </Screen>
  );
}
