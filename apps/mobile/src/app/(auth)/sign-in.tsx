import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Notice, Screen, Txt } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { DEMO_MODE } from '../../lib/config';
import { space, useTheme } from '../../lib/theme';

export default function SignIn() {
  const c = useTheme();
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState(DEMO_MODE ? 'demo@civicpass.example' : '');
  const [password, setPassword] = useState(DEMO_MODE ? 'Demo1234!' : '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt v="body" muted>
        {t('signInSubtitle')}
      </Txt>
      <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={t('signIn')} onPress={submit} loading={busy} disabled={!email || !password} />
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="key-outline" size={14} color={c.textFaint} />
        <Txt v="caption" faint>
          {t('demoHint')}
        </Txt>
      </View>
    </Screen>
  );
}
