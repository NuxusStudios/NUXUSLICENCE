import { Stack } from 'expo-router';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

export default function AuthLayout() {
  const { t } = useI18n();
  const c = useTheme();
  return (
    <Stack screenOptions={{ headerTintColor: c.primary, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.text }, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('signIn') }} />
      <Stack.Screen name="register" options={{ title: t('getStarted') }} />
    </Stack>
  );
}
