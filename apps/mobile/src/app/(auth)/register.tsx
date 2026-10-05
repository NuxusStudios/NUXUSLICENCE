import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, IconTile, Notice, PressScale, Screen, Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';

/**
 * Three-step onboarding that replaces Sanad's in-person activation:
 * 1. match licence number + DOB against the registry
 * 2. document scan + liveness selfie through an identity-verification SDK
 * 3. account credentials
 */
export default function Register() {
  const { completeRegistration } = useAuth();
  const { t, lang } = useI18n();
  const c = useTheme();
  const [step, setStep] = useState(1);
  const [licenceNumber, setLicence] = useState('');
  const [dateOfBirth, setDob] = useState('');
  const [docScanned, setDocScanned] = useState(false);
  const [selfieTaken, setSelfieTaken] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
      const { accessToken } = await api.register({ email, password, phone: phone || undefined, licenceNumber, dateOfBirth, idvSessionId, language: lang });
      await completeRegistration(accessToken);
    } catch (e) {
      setError((e as Error).message);
      // Identity mismatch → send them back to fix the details.
      if ((e as { code?: string }).code === 'identity_not_matched') setStep(1);
    } finally {
      setBusy(false);
    }
  }

  const header = (title: string, body: string) => (
    <View style={{ gap: space.sm }}>
      <Txt v="label" color={c.accent}>
        {t('stepOf').replace('{n}', String(step))}
      </Txt>
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
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={t('stepOf').replace('{n}', String(step))}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? c.accent : c.border }} />
        ))}
      </View>
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
          {header(t('regStep3'), t('regStep3Body'))}
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <Button title={t('createAccount')} onPress={submit} loading={busy} disabled={!email.includes('@') || password.length < 8} />
          <Button title={t('back')} variant="ghost" size="md" onPress={() => setStep(2)} />
        </>
      )}
    </Screen>
  );
}
