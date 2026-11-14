import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Glass, Txt, type IconName } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fonts, useTheme } from '../../lib/theme';

const NATIVE = Platform.OS !== 'web';

// Icon per tab route. The focused glyph is the filled variant.
const ICONS: Record<string, IconName> = {
  index: 'home',
  wallet: 'wallet',
  services: 'grid',
  fines: 'receipt',
  account: 'person',
};

/**
 * Floating liquid-glass dock (Ron Design Lab / "adjustable glass" style): a
 * centered frosted capsule that floats over the content. The active tab expands
 * into a tinted pill that reveals its label; the others stay icon-only, so all
 * five fit comfortably on a phone.
 */
function GlassDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.dockWrap, { paddingBottom: insets.bottom + 10 }]}>
      <Glass intensity={64} style={styles.dock}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const base = ICONS[route.name] ?? 'ellipse';
          const name = (focused ? base : `${base}-outline`) as IconName;
          const onPress = () => {
            if (NATIVE) void Haptics.selectionAsync().catch(() => undefined);
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={[styles.tab, focused && { backgroundColor: c.primarySoft, paddingHorizontal: 14 }]}
            >
              <Ionicons name={name} size={21} color={focused ? c.accent : c.textFaint} />
              {focused ? (
                <Txt v="caption" color={c.accent} style={styles.tabLabel} numberOfLines={1}>
                  {label}
                </Txt>
              ) : null}
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  const { t, tr } = useI18n();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GlassDock {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('tabHome') }} />
      <Tabs.Screen name="wallet" options={{ title: t('tabWallet') }} />
      <Tabs.Screen name="services" options={{ title: tr('Services', 'Services') }} />
      <Tabs.Screen name="fines" options={{ title: t('tabFines') }} />
      <Tabs.Screen name="account" options={{ title: t('tabAccount') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 30,
    maxWidth: '94%',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    borderRadius: 24,
    paddingHorizontal: 13,
    justifyContent: 'center',
  },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 12.5, letterSpacing: -0.1 },
});
