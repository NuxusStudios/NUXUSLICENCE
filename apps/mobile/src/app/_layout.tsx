import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PrototypeBanner } from '../components/PrototypeBanner';
import { Loading } from '../components/ui';
import { LockScreen } from '../components/LockScreen';
import { AuthProvider, useAuth } from '../lib/auth';
import { I18nProvider, useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { usePushRegistration } from '../lib/push';

function RootNavigator() {
  const { status } = useAuth();
  const { t } = useI18n();
  const c = useTheme();
  usePushRegistration(status === 'signedIn');

  if (status === 'loading') return <Loading />;
  if (status === 'locked') return <LockScreen />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.primary,
        headerTitleStyle: { color: c.text },
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="credential/[id]" options={{ title: '' }} />
        <Stack.Screen name="vehicle/[id]" options={{ title: '' }} />
        <Stack.Screen name="fine/[id]" options={{ title: '' }} />
        <Stack.Screen name="dispute/[id]" options={{ title: t('dispute'), presentation: 'modal' }} />
        <Stack.Screen name="pay" options={{ title: t('payTitle'), presentation: 'modal' }} />
        <Stack.Screen name="services/index" options={{ title: t('servicesTitle') }} />
        <Stack.Screen name="services/[id]" options={{ title: '' }} />
        <Stack.Screen name="inbox" options={{ title: t('inboxTitle') }} />
        <Stack.Screen name="sign" options={{ title: t('signTitle') }} />
        <Stack.Screen name="access-log" options={{ title: t('accessLog') }} />
        <Stack.Screen name="payments" options={{ title: t('payments') }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Verifying someone else's QR code works signed in or out. */}
      <Stack.Screen name="verify" options={{ title: t('verifyTitle') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const c = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusBar style="auto" />
      <PrototypeBanner />
      <RootNavigator />
    </SafeAreaView>
  );
}
