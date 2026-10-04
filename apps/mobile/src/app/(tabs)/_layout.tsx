import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useTheme();
  const icon = (name: IconName) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <Ionicons name={name} color={color as string} size={size} />;
    };
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.text, fontWeight: '800' },
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
