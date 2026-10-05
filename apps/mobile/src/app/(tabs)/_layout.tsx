import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fonts, useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useTheme();
  // Filled icon when selected, outline otherwise.
  const icon = (name: IconName) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean; size: number }) {
      return <Ionicons name={(focused ? name : `${name}-outline`) as IconName} color={color as string} size={23} />;
    };
  return (
    <Tabs
      screenOptions={{
        // Each tab screen draws its own large title.
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.1 },
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border, height: 64, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tabWallet'), tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="vehicles" options={{ title: t('tabVehicles'), tabBarIcon: icon('car-sport') }} />
      <Tabs.Screen name="fines" options={{ title: t('tabFines'), tabBarIcon: icon('receipt') }} />
      <Tabs.Screen name="account" options={{ title: t('tabAccount'), tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
