import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import { TabBarBackground, type IconName } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fonts, useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const { t, tr } = useI18n();
  const c = useTheme();
  // Sanad tab bar: a soft-blue pill sits behind the active icon, which turns
  // blue; inactive icons are the outline glyph in a faint tint.
  const icon = (name: IconName) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return (
        <View style={[styles.pill, focused && { backgroundColor: c.primarySoft }]}>
          <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={focused ? c.accent : c.textFaint} size={22} />
        </View>
      );
    };
  // The Account tab reads as a profile chip (Sanad shows the user's photo here).
  const accountIcon = ({ focused }: { focused: boolean }) => (
    <View style={[styles.avatar, { backgroundColor: focused ? c.accent : c.surfaceAlt, borderColor: focused ? c.accent : c.border }]}>
      <Ionicons name="person" color={focused ? '#FFFFFF' : c.textMuted} size={15} />
    </View>
  );
  return (
    <Tabs
      screenOptions={{
        // Each tab screen draws its own large title.
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.1 },
        // Floating liquid-glass tab bar: content scrolls under it.
        tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0, height: 66, paddingTop: 6, paddingBottom: 8 },
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tabWallet'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="services" options={{ title: tr('Services', 'Services'), tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="fines" options={{ title: t('tabFines'), tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="account" options={{ title: t('tabAccount'), tabBarIcon: accountIcon }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 46, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
