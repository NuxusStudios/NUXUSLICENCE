import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, radius, space, type, useTheme, type TypeVariant } from '../lib/theme';
import { useI18n } from '../lib/i18n';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const NATIVE = Platform.OS !== 'web';

function tap() {
  if (NATIVE) void Haptics.selectionAsync().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Txt({
  v = 'body',
  color,
  muted,
  faint,
  style,
  children,
  ...rest
}: ComponentProps<typeof Text> & { v?: TypeVariant; color?: string; muted?: boolean; faint?: boolean }) {
  const c = useTheme();
  const tint = color ?? (faint ? c.textFaint : muted ? c.textMuted : c.text);
  return (
    <Text style={[type[v] as TextStyle, { color: tint }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Txt v="title" accessibilityRole="header">
      {children}
    </Txt>
  );
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Txt v="body" muted={muted} style={style}>
      {children}
    </Txt>
  );
}

export function SectionHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt v="label" muted accessibilityRole="header">
        {children}
      </Txt>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Scrolling screen. Pass `title` for an in-page large title (used by the tab
 * screens, which hide the native header).
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const c = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.textMuted} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {title ? (
        <View style={styles.largeHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            {subtitle ? <Txt v="caption" muted>{subtitle}</Txt> : null}
            <Txt v="display" accessibilityRole="header">
              {title}
            </Txt>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

/** Pressable that gives a gentle scale-down and a haptic tick. */
export function PressScale({
  children,
  onPress,
  style,
  containerStyle,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  scaleTo = 0.975,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** Visual styles; these scale on press. */
  style?: StyleProp<ViewStyle>;
  /** Layout in the parent (width, margins). Applied to the pressable itself so the parent sizes it correctly. */
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: ComponentProps<typeof Pressable>['accessibilityRole'];
  accessibilityState?: ComponentProps<typeof Pressable>['accessibilityState'];
  scaleTo?: number;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: NATIVE, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  flush,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** No inner padding, for lists that manage their own insets. */
  flush?: boolean;
}) {
  const c = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: c.surface, borderColor: c.hairline, boxShadow: c.shadow },
    flush && { padding: 0, gap: 0 },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={base}>
      {children}
    </PressScale>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'black';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md';
}) {
  const c = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryText, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    danger: { bg: c.dangerBg, fg: c.danger, border: c.dangerBg },
    ghost: { bg: 'transparent', fg: c.accent, border: 'transparent' },
    black: { bg: '#000000', fg: '#FFFFFF', border: '#000000' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <PressScale
      onPress={onPress}
      disabled={inactive}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.button,
        size === 'md' && { minHeight: 44, borderRadius: radius.sm },
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : 1 },
        variant === 'primary' && !inactive && { boxShadow: c.shadow },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={19} color={palette.fg} />}
          <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </PressScale>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: c.surface, boxShadow: c.shadow }]}
          >
            <Text style={[styles.segmentText, { color: on ? c.text : c.textMuted, fontFamily: on ? fonts.semibold : fonts.medium }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Txt v="caption" muted style={{ fontFamily: fonts.semibold }}>
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textFaint}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: c.text,
            backgroundColor: c.surface,
            borderColor: error ? c.danger : focused ? c.accent : c.border,
            boxShadow: focused ? `0px 0px 0px 3px ${c.primarySoft}` : 'none',
          },
          style,
        ]}
        {...props}
      />
      {error ? <Txt v="caption" color={c.danger}>{error}</Txt> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function Row({ label, value, strong, mono }: { label: string; value?: ReactNode; strong?: boolean; mono?: boolean }) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <Txt v="caption" muted style={styles.rowLabel}>
        {label}
      </Txt>
      <Text
        style={[
          strong ? type.headline : mono ? { ...type.mono, fontSize: 14 } : type.callout,
          { color: c.text, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
        ]}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

export function IconTile({ icon, tone, size = 40 }: { icon: IconName; tone?: 'danger' | 'warning' | 'success' | 'accent'; size?: number }) {
  const c = useTheme();
  const map = {
    danger: [c.dangerBg, c.danger],
    warning: [c.warningBg, c.warning],
    success: [c.successBg, c.success],
    accent: [c.primarySoft, c.accent],
  } as const;
  const [bg, fg] = map[tone ?? 'accent'];
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={fg} />
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
  const content = (
    <>
      {icon && <IconTile icon={icon} tone={tone} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="strong" numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="caption" muted numberOfLines={3}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={17} color={c.textFaint} />}
    </>
  );
  if (!onPress) return <View style={styles.listItem}>{content}</View>;
  return (
    <PressScale onPress={onPress} style={styles.listItem} scaleTo={0.985}>
      {content}
    </PressScale>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'info' }) {
  const c = useTheme();
  const map = {
    neutral: [c.surfaceAlt, c.textMuted],
    danger: [c.dangerBg, c.danger],
    warning: [c.warningBg, c.warning],
    success: [c.successBg, c.success],
    info: [c.primarySoft, c.accent],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: fg }]} />
      <Text style={{ color: fg, fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

export function Notice({ tone, children }: { tone: 'danger' | 'warning' | 'success' | 'info'; children: ReactNode }) {
  const c = useTheme();
  const map = {
    danger: [c.dangerBg, c.danger, 'alert-circle'],
    warning: [c.warningBg, c.warning, 'warning'],
    success: [c.successBg, c.success, 'checkmark-circle'],
    info: [c.primarySoft, c.accent, 'information-circle'],
  } as const;
  const [bg, fg, icon] = map[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
      <Text style={[type.callout, { color: fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function Loading() {
  const { t } = useI18n();
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg, gap: space.md }]}>
      <ActivityIndicator color={c.textMuted} />
      <Txt v="caption" muted>
        {t('loading')}
      </Txt>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useI18n();
  const c = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg, padding: space.xl, gap: space.lg }]}>
      <IconTile icon="cloud-offline-outline" size={56} />
      <Txt v="body" style={{ textAlign: 'center' }}>
        {error.message}
      </Txt>
      <Button title={t('retry')} onPress={onRetry} variant="secondary" size="md" />
    </View>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.md }}>
      <IconTile icon={icon} size={52} tone="success" />
      <Txt v="callout" muted style={{ textAlign: 'center' }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, paddingBottom: space.xxl * 2.5, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  largeHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, marginBottom: -space.xs, paddingHorizontal: 2 },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontSize: 16, fontFamily: fonts.semibold, letterSpacing: -0.1 },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  segmentText: { fontSize: 14 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16, fontFamily: fonts.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.lg, paddingVertical: 7 },
  rowLabel: { flexShrink: 0, maxWidth: '45%' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 60 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: space.sm, padding: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, alignItems: 'flex-start' },
});
