import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Per-weight imports so only the faces we use are bundled (the package index pulls in all 18).
import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { HankenGrotesk_800ExtraBold } from '@expo-google-fonts/hanken-grotesk/800ExtraBold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PrototypeBanner } from '../components/PrototypeBanner';
import { Loading } from '../components/ui';
import { LockScreen } from '../components/LockScreen';
import { AuthProvider, useAuth } from '../lib/auth';
import { I18nProvider, useI18n } from '../lib/i18n';
import { fonts, useIsDark, useTheme } from '../lib/theme';
import { APP_NAME } from '../lib/config';
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
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { color: c.text, fontFamily: fonts.semibold, fontSize: 17 },
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={status === 'signedIn'}>
        {/* The title is what the back button announces to screen readers ("CivicPass, back"). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: APP_NAME }} />
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
  const [loaded, error] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          {/* If fonts fail to load the app still runs on system fonts. */}
          {loaded || error ? <Shell /> : <Loading />}
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const c = useTheme();
  const dark = useIsDark();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <PrototypeBanner />
      <RootNavigator />
    </SafeAreaView>
  );
}
