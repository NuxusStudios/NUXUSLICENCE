import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  const c = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[padded && { padding: space.lg, paddingBottom: space.xxl * 2 }, { gap: space.lg }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useTheme();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.textMuted }]}>{children}</Text>
      {action}
    </View>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<any> }) {
  const c = useTheme();
  return <Text style={[styles.body, { color: muted ? c.textMuted : c.text }, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryText, border: c.primary },
    secondary: { bg: c.surface, fg: c.primary, border: c.border },
    danger: { bg: c.dangerBg, fg: c.danger, border: c.dangerBg },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: error ? c.danger : c.border }]}
        {...props}
      />
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function Row({ label, value, strong }: { label: string; value?: ReactNode; strong?: boolean }) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: c.text }, strong && { fontWeight: '700', fontSize: 17 }]}>{value ?? '—'}</Text>
    </View>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  tone,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'danger' | 'warning' | 'success';
}) {
  const c = useTheme();
  const iconColor = tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : tone === 'success' ? c.success : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
    >
      {icon && (
        <View style={[styles.listIcon, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.listTitle, { color: c.text }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
    </Pressable>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: space.xs }} />;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'info' }) {
  const c = useTheme();
  const map = {
    neutral: [c.surfaceAlt, c.textMuted],
    danger: [c.dangerBg, c.danger],
    warning: [c.warningBg, c.warning],
    success: [c.successBg, c.success],
    info: [c.surfaceAlt, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  const { t } = useI18n();
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.primary} />
      <Text style={{ color: c.textMuted, marginTop: space.sm }}>{t('loading')}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useI18n();
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg, padding: space.xl, gap: space.md }]}>
      <Ionicons name="cloud-offline-outline" size={40} color={c.textMuted} />
      <Text style={{ color: c.text, textAlign: 'center' }}>{error.message}</Text>
      <Button title={t('retry')} onPress={onRetry} variant="secondary" />
    </View>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={36} color={c.textMuted} />
      <Text style={{ color: c.textMuted, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function Notice({ tone, children }: { tone: 'danger' | 'warning' | 'success' | 'info'; children: ReactNode }) {
  const c = useTheme();
  const map = {
    danger: [c.dangerBg, c.danger, 'alert-circle'],
    warning: [c.warningBg, c.warning, 'warning'],
    success: [c.successBg, c.success, 'checkmark-circle'],
    info: [c.surfaceAlt, c.primary, 'information-circle'],
  } as const;
  const [bg, fg, icon] = map[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={{ color: fg, flex: 1, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  title: { fontSize: 26, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg, paddingVertical: 6 },
  rowLabel: { fontSize: 14, flexShrink: 0, maxWidth: '45%' },
  rowValue: { fontSize: 15, fontWeight: '500', flex: 1, textAlign: 'right' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 52 },
  listIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '600' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
});
