import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Field, Notice, Screen, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { space, useTheme } from '../../lib/theme';

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

  const Steps = (
    <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityLabel={`Step ${step} of 3`}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? c.primary : c.border }} />
      ))}
    </View>
  );

  return (
    <Screen>
      {Steps}
      {error && <Notice tone="danger">{error}</Notice>}

      {step === 1 && (
        <>
          <Title>{t('regStep1')}</Title>
          <Body muted>{t('regStep1Body')}</Body>
          <Field label={t('licenceNumber')} value={licenceNumber} onChangeText={setLicence} autoCapitalize="characters" placeholder="A1234-56789-01234" />
          <Field label={t('dateOfBirth')} value={dateOfBirth} onChangeText={setDob} placeholder="1990-01-31" keyboardType="numbers-and-punctuation" />
          <Button title={t('continue')} onPress={() => setStep(2)} disabled={licenceNumber.length < 5 || !dobValid} />
          <Body muted>{t('regDemoHint')}</Body>
        </>
      )}

      {step === 2 && (
        <>
          <Title>{t('regStep2')}</Title>
          <Body muted>{t('regStep2Body')}</Body>
          <Card>
            <Button
              title={docScanned ? `✓ ${t('scanned')}` : t('scanDocument')}
              icon="card"
              variant={docScanned ? 'secondary' : 'primary'}
              onPress={() => setDocScanned(true)}
            />
            <Button
              title={selfieTaken ? `✓ ${t('scanned')}` : t('takeSelfie')}
              icon="happy"
              variant={selfieTaken ? 'secondary' : 'primary'}
              onPress={() => setSelfieTaken(true)}
              disabled={!docScanned}
            />
          </Card>
          <Button title={t('continue')} onPress={() => setStep(3)} disabled={!docScanned || !selfieTaken} />
          <Button title={t('back')} variant="ghost" onPress={() => setStep(1)} />
        </>
      )}

      {step === 3 && (
        <>
          <Title>{t('regStep3')}</Title>
          <Body muted>{t('regStep3Body')}</Body>
          <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
          <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <Button title={t('createAccount')} onPress={submit} loading={busy} disabled={!email.includes('@') || password.length < 8} />
          <Button title={t('back')} variant="ghost" onPress={() => setStep(2)} />
        </>
      )}
    </Screen>
  );
}
