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
  const { t, tr } = useI18n();
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
        <Stack.Screen name="inbox" options={{ title: t('inboxTitle') }} />
        <Stack.Screen name="sign" options={{ title: tr('My signature', 'Ma signature') }} />
        <Stack.Screen name="access-log" options={{ title: t('accessLog') }} />
        <Stack.Screen name="payments" options={{ title: tr('Payment history', 'Historique des paiements') }} />
        <Stack.Screen name="payment/[id]" options={{ title: tr('Payment details', 'Détails du paiement') }} />
        <Stack.Screen name="vehicles" options={{ title: '' }} />
        <Stack.Screen name="requests/index" options={{ title: tr('My requests', 'Mes demandes') }} />
        <Stack.Screen name="requests/[id]" options={{ title: tr('Request', 'Demande') }} />
        <Stack.Screen name="appointments/index" options={{ title: tr('My appointments', 'Mes rendez-vous') }} />
        <Stack.Screen name="appointments/book" options={{ title: tr('Book an appointment', 'Prendre rendez-vous') }} />
        <Stack.Screen name="appointments/[id]" options={{ title: tr('Appointment', 'Rendez-vous') }} />
        <Stack.Screen name="consents" options={{ title: tr('Data requests', 'Demandes de données') }} />
        <Stack.Screen name="plates" options={{ title: tr('Personalized plates', 'Plaques personnalisées') }} />
        <Stack.Screen name="favourites" options={{ title: tr('Favourites', 'Favoris') }} />
        <Stack.Screen name="cards" options={{ title: tr('Saved cards', 'Cartes enregistrées') }} />
        <Stack.Screen name="notifications" options={{ title: tr('Notifications', 'Notifications') }} />
        <Stack.Screen name="security/password" options={{ title: tr('Change password', 'Changer le mot de passe') }} />
        <Stack.Screen name="security/pin" options={{ title: tr('Digital ID PIN', 'NIP d’identité numérique') }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Guest access (Sanad lets non-activated users browse): verify a QR code,
          browse services, find a location, read help. Signed in or out. */}
      <Stack.Screen name="verify" options={{ title: t('verifyTitle') }} />
      <Stack.Screen name="directory" options={{ title: tr('Services', 'Services') }} />
      <Stack.Screen name="services/[id]" options={{ title: '' }} />
      <Stack.Screen name="locations" options={{ title: tr('Locations', 'Bureaux') }} />
      <Stack.Screen name="help/index" options={{ title: tr('Help centre', 'Centre d’aide') }} />
      <Stack.Screen name="help/feedback" options={{ title: tr('Suggestions and complaints', 'Suggestions et plaintes') }} />
      <Stack.Screen name="help/rate" options={{ title: tr('Rate your experience', 'Évaluez votre expérience') }} />
      <Stack.Screen name="help/about" options={{ title: tr('About', 'À propos') }} />
      <Stack.Screen name="help/privacy" options={{ title: tr('Privacy policy', 'Politique de confidentialité') }} />
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
