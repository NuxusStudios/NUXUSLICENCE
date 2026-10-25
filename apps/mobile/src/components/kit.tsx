// Building blocks for the Sanad-style flows: widgets, steppers, statuses,
// PIN entry, signature pad. Everything bilingual, no system dialogs (they
// aren't available in every host, e.g. embedded web views).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Badge, Button, Card, Glass, IconTile, Notice, PressScale, Txt, type IconName } from './ui';
import { DEMO_MODE } from '../lib/config';
import { DEMO_PIN } from '../lib/demo/backend';
import { date, dateTime, money, timeAgo } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { passwordChecks, type Appointment, type RequestEvent, type RequestStatus } from '../lib/shared/platform';
import { LICENCE_STATUS_LABEL, LICENCE_STATUS_TONE, licenceConditionLabels, licenceStatusMessage, type LicenceStatus } from '../lib/shared/licence-status';
import { POA_CASE_LABEL, POA_CASE_TONE, poaCaseMessage, type POACaseStatus } from '../lib/shared/poa';
import type { Credential, CredentialType } from '../lib/types';
import { fonts, radius, space, useIsDark, useTheme } from '../lib/theme';

// ---------------------------------------------------------------------------
// Dashboard widget: a titled card with an optional "View all" link
// ---------------------------------------------------------------------------

export function Widget({
  title,
  subtitle,
  action,
  onAction,
  children,
  flush,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  flush?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.widgetHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="section" accessibilityRole="header">
            {title}
          </Txt>
          {subtitle ? (
            <Txt v="caption" faint>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}>
            <Txt v="strong" color={c.accent}>
              {action}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {flush ? children : <Glass style={styles.widgetBox}>{children}</Glass>}
    </View>
  );
}

/**
 * A bento-grid tile: large radius, a small uppercase label header, optional
 * "view all" action, and an optional solid-accent "anchor" treatment. The
 * building block of the dashboard's bento layout.
 */
export function BentoTile({
  title,
  action,
  onAction,
  onPress,
  accent,
  pad = true,
  children,
  style,
}: {
  title?: string;
  action?: string;
  onAction?: () => void;
  onPress?: () => void;
  accent?: boolean;
  pad?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const headColor = accent ? c.primaryText : c.textMuted;
  const tileStyle: StyleProp<ViewStyle> = [styles.bento, !pad && { padding: 0 }, style];
  const body = (
    <>
      {title || (action && onAction) ? (
        <View style={styles.bentoHead}>
          {title ? <Text style={[styles.bentoTitle, { color: headColor, opacity: accent ? 0.9 : 1 }]}>{title}</Text> : <View />}
          {action && onAction ? (
            <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}>
              <Txt v="strong" color={accent ? c.primaryText : c.accent}>
                {action}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );
  // Accent tiles are a vibrant gradient; the rest are frosted glass.
  const shell = accent ? (
    <LinearGradient colors={[c.gradFrom, c.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tileStyle}>
      {body}
    </LinearGradient>
  ) : (
    <Glass style={tileStyle}>{body}</Glass>
  );
  if (onPress) {
    return (
      <PressScale onPress={onPress} scaleTo={0.99}>
        {shell}
      </PressScale>
    );
  }
  return shell;
}

/** A row of bento tiles that share a line (each child flexes to fill). */
export function BentoRow({ children }: { children: ReactNode }) {
  return <View style={styles.bentoRow}>{children}</View>;
}

/** A square shortcut tile in a grid (Sanad "Quick access"). */
export function Tile({ icon, label, onPress, badge, width = '25%' }: { icon: IconName; label: string; onPress: () => void; badge?: number; width?: `${number}%` }) {
  const c = useTheme();
  return (
    <PressScale onPress={onPress} containerStyle={{ width }} style={styles.tile} accessibilityLabel={badge ? `${label}, ${badge}` : label}>
      <View>
        <IconTile icon={icon} size={48} />
        {badge ? (
          <View style={[styles.tileBadge, { backgroundColor: c.danger, borderColor: c.surface }]}>
            <Text style={styles.tileBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Txt v="caption" style={{ textAlign: 'center', fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
        {label}
      </Txt>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Sanad quick-access tile + document tile
// ---------------------------------------------------------------------------

/** Add an alpha channel to a #RRGGBB hex colour. */
function hexA(hex: string, alpha: number) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/**
 * A large Sanad "Quick access" tile: a soft grey rounded card with a blue line
 * icon and a bold label. The `highlight` tile uses a blue→violet gradient
 * (Sanad's one featured shortcut).
 */
export function QuickTile({ icon, label, onPress, badge, highlight }: { icon: IconName; label: string; onPress: () => void; badge?: number; highlight?: boolean }) {
  const c = useTheme();
  const body = (
    <>
      <View style={[styles.quickIcon, { backgroundColor: highlight ? hexA(c.primaryText, 0.16) : c.surface }]}>
        <Ionicons name={icon} size={22} color={highlight ? c.primaryText : c.accent} />
        {badge ? (
          <View style={[styles.tileBadge, { backgroundColor: c.danger, borderColor: highlight ? 'transparent' : c.surfaceAlt }]}>
            <Text style={styles.tileBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, color: highlight ? c.primaryText : c.text }} numberOfLines={2}>
        {label}
      </Text>
    </>
  );
  return (
    <PressScale onPress={onPress} containerStyle={{ flex: 1 }} accessibilityLabel={badge ? `${label}, ${badge}` : label}>
      {highlight ? (
        <LinearGradient colors={[c.gradFrom, c.gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickTile}>
          {body}
        </LinearGradient>
      ) : (
        <Glass style={styles.quickTile}>{body}</Glass>
      )}
    </PressScale>
  );
}

const DOC_INK: Record<CredentialType, string> = {
  driver_licence: '#2563EB',
  photo_card: '#5A6472',
  health_card: '#7C4DD6',
  vehicle_permit: '#12795A',
};
const DOC_ICON: Record<CredentialType, IconName> = {
  driver_licence: 'card',
  photo_card: 'person',
  health_card: 'medkit',
  vehicle_permit: 'car',
};

/**
 * A Sanad-style document tile for the 2-column wallet grid: a soft tinted card
 * with the document name, its number, and its expiry (or a red status when the
 * document isn't valid).
 */
export function DocumentTile({ credential, onPress }: { credential: Credential; onPress: () => void }) {
  const c = useTheme();
  const { t, tr, lang } = useI18n();
  // Dark mode is monochrome: document tiles tint in silver, not per-type colour.
  const ink = useIsDark() ? '#CDD2DE' : DOC_INK[credential.type];
  const bad = credential.status !== 'valid';
  const statusText = bad
    ? { expired: tr('Expired', 'Expiré'), suspended: tr('Suspended', 'Suspendu'), revoked: tr('Revoked', 'Révoqué') }[credential.status as 'expired' | 'suspended' | 'revoked']
    : `${tr('Exp.', 'Exp.')} ${date(credential.expiresOn, lang)}`;
  return (
    <PressScale onPress={onPress} containerStyle={{ flex: 1 }} accessibilityLabel={t(credential.type)}>
      <Glass style={styles.docTile}>
        {/* A faint colour wash tints the frosted panel per document type. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: hexA(ink, 0.16) }]} pointerEvents="none" />
        <View style={[styles.docIcon, { backgroundColor: hexA(ink, 0.28) }]}>
          <Ionicons name={DOC_ICON[credential.type]} size={19} color={ink} />
        </View>
        <View style={{ gap: 2 }}>
          <Txt v="strong" numberOfLines={2}>
            {t(credential.type)}
          </Txt>
          <Txt v="caption" faint numberOfLines={1}>
            {credential.documentNumber}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name={bad ? 'alert-circle' : 'time-outline'} size={13} color={bad ? c.danger : c.textMuted} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: bad ? c.danger : c.textMuted }}>{statusText}</Text>
        </View>
      </Glass>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Chips and search
// ---------------------------------------------------------------------------

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress: () => void; icon?: IconName }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[styles.chip, { borderColor: on ? c.accent : c.border, backgroundColor: 'transparent' }]}
    >
      {icon ? <Ionicons name={icon} size={15} color={on ? c.accent : c.textMuted} /> : null}
      <Text style={{ color: on ? c.accent : c.textMuted, fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const c = useTheme();
  return (
    <Glass style={styles.search}>
      <Ionicons name="search" size={18} color={c.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textFaint}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        style={{ flex: 1, color: c.text, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 12 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear" hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={c.textFaint} />
        </Pressable>
      ) : null}
    </Glass>
  );
}

/** Tappable checkbox row for declarations. */
export function Check({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  const c = useTheme();
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.check}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? c.accent : c.textFaint} />
      <Txt v="callout" style={{ flex: 1 }}>
        {children}
      </Txt>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Stepper (Sanad's "Steps" navigation)
// ---------------------------------------------------------------------------

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  const c = useTheme();
  const { tr } = useI18n();
  return (
    <View style={{ gap: space.sm }} accessibilityLabel={tr(`Step ${current + 1} of ${steps.length}: ${steps[current]}`, `Étape ${current + 1} de ${steps.length} : ${steps[current]}`)}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? c.accent : c.border }} />
        ))}
      </View>
      <Txt v="caption" muted style={{ fontFamily: fonts.semibold }}>
        {tr(`Step ${current + 1} of ${steps.length}`, `Étape ${current + 1} de ${steps.length}`)} · {steps[current]}
      </Txt>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Request status
// ---------------------------------------------------------------------------

export const REQUEST_TONE: Record<RequestStatus | 'submitted', 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  submitted: 'neutral',
  in_review: 'info',
  awaiting_payment: 'warning',
  action_required: 'warning',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

export function useRequestStatusLabel() {
  const { tr } = useI18n();
  return (s: RequestStatus | 'submitted') =>
    ({
      submitted: tr('Submitted', 'Soumise'),
      in_review: tr('In review', 'En traitement'),
      awaiting_payment: tr('Awaiting payment', 'Paiement attendu'),
      action_required: tr('Action required', 'Action requise'),
      completed: tr('Completed', 'Terminée'),
      rejected: tr('Rejected', 'Refusée'),
      cancelled: tr('Cancelled', 'Annulée'),
    })[s];
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const label = useRequestStatusLabel();
  return <Badge label={label(status)} tone={REQUEST_TONE[status]} />;
}

export function Timeline({ events }: { events: RequestEvent[] }) {
  const c = useTheme();
  const { lang, pick } = useI18n();
  const label = useRequestStatusLabel();
  return (
    <View>
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const tone = REQUEST_TONE[e.status];
        const color = tone === 'success' ? c.success : tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.accent;
        return (
          <View key={`${e.status}${e.at}${i}`} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ alignItems: 'center', width: 16 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: last ? color : c.surface, borderWidth: 2, borderColor: color }} />
              {!last && <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginVertical: 2 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : space.lg, gap: 2 }}>
              <Txt v="strong">{label(e.status)}</Txt>
              <Txt v="caption" muted>
                {dateTime(e.at, lang)}
              </Txt>
              {e.note ? (
                <Txt v="caption" color={c.warning}>
                  {pick(e.note)}
                </Txt>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Label and tone for an appointment status. */
export function useAppointmentStatus() {
  const { tr } = useI18n();
  return (a: Appointment) =>
    ({
      upcoming: { label: tr('Upcoming', 'À venir'), tone: 'info' as const },
      checked_in: { label: tr('Checked in', 'Enregistré'), tone: 'success' as const },
      completed: { label: tr('Completed', 'Terminé'), tone: 'neutral' as const },
      cancelled: { label: tr('Cancelled', 'Annulé'), tone: 'neutral' as const },
    })[a.status];
}

// ---------------------------------------------------------------------------
// Accordion (FAQ, service card sections)
// ---------------------------------------------------------------------------

export function Accordion({ title, children, initiallyOpen, icon }: { title: string; children: ReactNode; initiallyOpen?: boolean; icon?: IconName }) {
  const c = useTheme();
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.accHead}>
        {icon ? <Ionicons name={icon} size={20} color={c.accent} /> : null}
        <Txt v="strong" style={{ flex: 1 }}>
          {title}
        </Txt>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={c.textMuted} />
      </Pressable>
      {open ? <View style={{ paddingBottom: space.md, gap: space.sm }}>{children}</View> : null}
    </View>
  );
}

/** Bulleted list. */
export function Bullets({ items, icon = 'ellipse' }: { items: string[]; icon?: IconName }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((it, i) => (
        <View key={`${i}${it}`} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          {icon === 'ellipse' ? (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 8 }} />
          ) : (
            <Ionicons name={icon} size={18} color={c.accent} style={{ marginTop: 1 }} />
          )}
          <Txt v="callout" style={{ flex: 1 }}>
            {it}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** Numbered steps. */
export function NumberedSteps({ items }: { items: string[] }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {items.map((it, i) => (
        <View key={`${i}${it}`} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <View style={[styles.stepNum, { backgroundColor: c.primarySoft }]}>
            <Text style={{ color: c.accent, fontFamily: fonts.bold, fontSize: 13 }}>{i + 1}</Text>
          </View>
          <Txt v="callout" style={{ flex: 1 }}>
            {it}
          </Txt>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Result panel (success / submitted)
// ---------------------------------------------------------------------------

export function ResultPanel({ icon = 'checkmark', tone = 'success', title, subtitle, children }: { icon?: IconName; tone?: 'success' | 'warning' | 'danger' | 'accent'; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
      <IconTile icon={icon} tone={tone} size={84} />
      <Txt v="title" style={{ textAlign: 'center' }} accessibilityRole="header">
        {title}
      </Txt>
      {subtitle ? (
        <Txt v="callout" muted style={{ textAlign: 'center' }}>
          {subtitle}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Password rules checklist
// ---------------------------------------------------------------------------

export function PasswordRules({ password }: { password: string }) {
  const c = useTheme();
  const { pick } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {passwordChecks(password).map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={17} color={r.ok ? c.success : c.textFaint} />
          <Txt v="caption" color={r.ok ? c.success : c.textMuted}>
            {pick(r.label)}
          </Txt>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PIN entry
// ---------------------------------------------------------------------------

/**
 * 4-digit digital ID PIN pad. Calls `onComplete` when four digits are in;
 * a thrown error is shown and the dots clear.
 */
export function PinPad({ title, subtitle, onComplete, onCancel, showDemoHint = true }: { title: string; subtitle?: string; onComplete: (pin: string) => Promise<void>; onCancel?: () => void; showDemoHint?: boolean }) {
  const c = useTheme();
  const { tr } = useI18n();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function press(k: string) {
    if (busy) return;
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    setError(undefined);
    if (next.length === 4) {
      setBusy(true);
      try {
        await onComplete(next);
      } catch (e) {
        setError((e as Error).message);
        setPin('');
      } finally {
        setBusy(false);
      }
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <Card style={{ gap: space.md, alignItems: 'center' }}>
      <IconTile icon="keypad" size={44} />
      <Txt v="headline" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt v="caption" muted style={{ textAlign: 'center' }}>
          {subtitle}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.lg, marginVertical: space.sm }} accessibilityLabel={tr(`${pin.length} of 4 digits entered`, `${pin.length} chiffres sur 4`)}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: error ? c.danger : c.accent, backgroundColor: i < pin.length ? (error ? c.danger : c.accent) : 'transparent' }} />
        ))}
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <View style={styles.keypad}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={`blank${i}`} style={styles.key} />
          ) : (
            <Pressable
              key={k}
              onPress={() => void press(k)}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? tr('Delete', 'Effacer') : k}
              style={({ pressed }) => [styles.key, { backgroundColor: pressed ? c.primarySoft : c.surfaceAlt }]}
            >
              {k === 'del' ? <Ionicons name="backspace-outline" size={22} color={c.text} /> : <Text style={{ color: c.text, fontFamily: fonts.semibold, fontSize: 24 }}>{k}</Text>}
            </Pressable>
          ),
        )}
      </View>
      {DEMO_MODE && showDemoHint ? (
        <Txt v="caption" faint>
          {tr(`Demo PIN: ${DEMO_PIN}`, `NIP de démonstration : ${DEMO_PIN}`)}
        </Txt>
      ) : null}
      {onCancel ? <Button title={tr('Cancel', 'Annuler')} variant="ghost" size="md" onPress={onCancel} /> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Signature pad
// ---------------------------------------------------------------------------

export const SIGNATURE_VIEWBOX = { w: 320, h: 140 };

/** Draw with a finger or mouse. Emits an SVG path in a 320×140 box. */
export function SignaturePad({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  const c = useTheme();
  const { tr } = useI18n();
  const [path, setPath] = useState(value);
  const size = useRef({ w: SIGNATURE_VIEWBOX.w, h: SIGNATURE_VIEWBOX.h });
  // Report every change; the pad owns the in-progress path so fast strokes don't drop points.
  useEffect(() => onChange(path), [path, onChange]);
  const pt = (x: number, y: number) => `${Math.round((x / size.current.w) * SIGNATURE_VIEWBOX.w)} ${Math.round((y / size.current.h) * SIGNATURE_VIEWBOX.h)}`;
  return (
    <View style={{ gap: space.sm }}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          const p = pt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          setPath((d) => `${d} M${p}`.trim());
        }}
        onResponderMove={(e) => {
          const p = pt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          setPath((d) => `${d} L${p}`);
        }}
        onLayout={(e) => (size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[styles.pad, { borderColor: c.border }]}
        accessibilityLabel={tr('Signature area. Draw your signature.', 'Zone de signature. Tracez votre signature.')}
        testID="signature-pad"
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_VIEWBOX.w} ${SIGNATURE_VIEWBOX.h}`} pointerEvents="none">
          <Path d={path || 'M0 0'} stroke="#0D1522" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        {!path ? (
          <Text style={styles.padHint} pointerEvents="none">
            {tr('Sign here', 'Signez ici')}
          </Text>
        ) : null}
        <View style={styles.padLine} pointerEvents="none" />
      </View>
      {path ? <Button title={tr('Clear', 'Effacer')} variant="ghost" size="md" icon="refresh" onPress={() => setPath('')} /> : null}
    </View>
  );
}

/** A saved signature, drawn small. */
export function SignatureView({ path, height = 60 }: { path: string; height?: number }) {
  return (
    <Svg width={(height * SIGNATURE_VIEWBOX.w) / SIGNATURE_VIEWBOX.h} height={height} viewBox={`0 0 ${SIGNATURE_VIEWBOX.w} ${SIGNATURE_VIEWBOX.h}`}>
      <Path d={path} stroke="#0D1522" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** "Can't find…? Suggest it" card (Sanad's suggest-a-service / missing document). */
export function SuggestCard({ icon, title, body, cta, onPress }: { icon: IconName; title: string; body: string; cta: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Card style={{ backgroundColor: c.goldBg, gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <Ionicons name={icon} size={24} color={c.gold} />
        <Txt v="strong" style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <Txt v="callout" muted>
        {body}
      </Txt>
      <Pressable onPress={onPress} accessibilityRole="button">
        <Txt v="strong" color={c.gold}>
          {cta} →
        </Txt>
      </Pressable>
    </Card>
  );
}

/** Header right button for stack screens. */
export function HeaderLink({ icon, label, to }: { icon: IconName; label: string; to: string }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => router.push(to as never)} accessibilityRole="button" accessibilityLabel={label} hitSlop={10} style={{ paddingHorizontal: 8 }}>
      <Ionicons name={icon} size={22} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bento: { borderRadius: 22, padding: space.lg, gap: space.md, overflow: 'hidden' },
  bentoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  bentoTitle: { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0 },
  bentoRow: { flexDirection: 'row', gap: space.md },
  widgetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xs, marginTop: space.sm },
  widgetBox: { borderRadius: 22, paddingHorizontal: space.lg, paddingVertical: space.xs, overflow: 'hidden' },
  tile: { alignItems: 'center', gap: 6, paddingHorizontal: 2, paddingVertical: space.xs },
  quickTile: { borderRadius: 20, padding: space.md, paddingVertical: space.lg, gap: space.md, minHeight: 108, justifyContent: 'space-between', overflow: 'hidden' },
  quickIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  docTile: { borderRadius: 20, padding: space.lg, gap: space.sm, minHeight: 138, justifyContent: 'space-between', overflow: 'hidden' },
  docIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tileBadge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2 },
  tileBadgeText: { color: '#fff', fontSize: 10, fontFamily: fonts.bold },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: 999, paddingHorizontal: space.lg },
  check: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingHorizontal: 2 },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 52 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 252, gap: 12, justifyContent: 'center' },
  key: { width: 72, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  pad: { height: 160, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  padHint: { position: 'absolute', left: 16, top: 12, color: '#8C96A6', fontFamily: fonts.medium, fontSize: 13 },
  padLine: { position: 'absolute', left: 16, right: 16, bottom: 34, height: 1, backgroundColor: '#C9CFD8' },
});

// ---------------------------------------------------------------------------
// Live driver's-licence status (refreshed automatically from the MTO record)
// ---------------------------------------------------------------------------

/**
 * Status pill + conditions + "checked Xh ago", with an optional manual
 * re-check. The badge updates on its own because the screens refresh the
 * licence on open; onRefresh just lets the user force it now.
 */
export function LicenceStatusCard({ status, onRefresh, refreshing }: { status?: LicenceStatus; onRefresh?: () => void; refreshing?: boolean }) {
  const c = useTheme();
  const { tr, pick, lang } = useI18n();
  const display = status?.display ?? 'unchecked';
  const tone = LICENCE_STATUS_TONE[display];
  const icon = display === 'valid' ? 'shield-checkmark' : display === 'expired' ? 'time' : display === 'unchecked' ? 'sync' : 'alert-circle';
  const toneColor = tone === 'success' ? c.success : tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.textMuted;
  const toneBg = tone === 'success' ? c.successBg : tone === 'danger' ? c.dangerBg : tone === 'warning' ? c.warningBg : c.surfaceAlt;
  const conditions = status ? licenceConditionLabels(status) : [];
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon as IconName} size={24} color={toneColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt v="headline" style={{ color: toneColor }}>
              {pick(LICENCE_STATUS_LABEL[display])}
            </Txt>
            <Badge label={tr('Live check', 'Vérification en direct')} tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'neutral'} />
          </View>
          {status ? (
            <Txt v="caption" faint>
              {tr('Checked automatically', 'Vérifié automatiquement')} · {timeAgo(status.checkedAt, lang)}
            </Txt>
          ) : null}
        </View>
        {onRefresh ? (
          <PressScale onPress={onRefresh} accessibilityLabel={tr('Check now', 'Vérifier maintenant')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={20} color={refreshing ? c.textFaint : c.text} />
          </PressScale>
        ) : null}
      </View>
      {status ? (
        <Txt v="callout" muted>
          {pick(licenceStatusMessage(status))}
        </Txt>
      ) : null}
      {conditions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {conditions.map((cond) => (
            <Badge key={cond.en} label={pick(cond)} tone="warning" />
          ))}
        </View>
      ) : null}
      <Txt v="caption" faint>
        {tr('Source: Ontario driver record (prototype uses demo data)', 'Source : dossier de conduite de l’Ontario (le prototype utilise des données fictives)')}
      </Txt>
    </Card>
  );
}

/**
 * Live court case status for a POA ticket (red-light / speed camera, or
 * officer-issued), refreshed automatically from POA Online Services. Shows
 * where the case stands, any amount owing, the next court date, and a manual
 * re-check.
 */
export function POACaseStatusCard({ status, onRefresh, refreshing }: { status?: POACaseStatus; onRefresh?: () => void; refreshing?: boolean }) {
  const c = useTheme();
  const { tr, pick, lang } = useI18n();
  const code = status?.code ?? 'before_court';
  const tone = status ? POA_CASE_TONE[code] : 'neutral';
  const toneColor = tone === 'success' ? c.success : tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : tone === 'info' ? c.accent : c.textMuted;
  const toneBg = tone === 'success' ? c.successBg : tone === 'danger' ? c.dangerBg : tone === 'warning' ? c.warningBg : tone === 'info' ? c.primarySoft : c.surfaceAlt;
  const icon: IconName =
    code === 'convicted' ? 'alert-circle' : code === 'in_default' ? 'warning' : code === 'paid' || code === 'withdrawn' ? 'checkmark-circle' : code === 'trial_scheduled' ? 'hammer' : code === 'early_resolution_scheduled' ? 'people' : 'business';
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: toneBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={24} color={toneColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            <Txt v="headline" style={{ color: toneColor }}>
              {pick(POA_CASE_LABEL[code])}
            </Txt>
            <Badge label={tr('Court status', 'État judiciaire')} tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral'} />
          </View>
          {status ? (
            <Txt v="caption" faint>
              {tr('Checked automatically', 'Vérifié automatiquement')} · {timeAgo(status.checkedAt, lang)}
            </Txt>
          ) : null}
        </View>
        {onRefresh ? (
          <PressScale onPress={onRefresh} accessibilityLabel={tr('Check now', 'Vérifier maintenant')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="refresh" size={20} color={refreshing ? c.textFaint : c.text} />
          </PressScale>
        ) : null}
      </View>
      {status ? (
        <Txt v="callout" muted>
          {pick(poaCaseMessage(status))}
        </Txt>
      ) : null}
      {status && status.amountOwing > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: toneBg, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <Txt v="label" style={{ color: toneColor }}>
            {tr('Fine owing to the court', 'Amende due au tribunal')}
          </Txt>
          <Txt v="strong" style={{ color: toneColor }}>
            {money(status.amountOwing, lang)}
            {status.fineDueOn ? ` · ${tr('by', 'avant le')} ${date(status.fineDueOn, lang)}` : ''}
          </Txt>
        </View>
      ) : null}
      {status?.nextEvent ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name={status.nextEvent.kind === 'trial' ? 'hammer-outline' : 'people-outline'} size={16} color={c.accent} />
          <Txt v="callout">
            {status.nextEvent.kind === 'trial' ? tr('Trial', 'Procès') : tr('Meeting with a prosecutor', 'Rencontre avec un procureur')} · {dateTime(status.nextEvent.at, lang)}
          </Txt>
        </View>
      ) : null}
      <Txt v="caption" faint>
        {tr('Source: POA Online Services (prototype uses demo data)', 'Source : services en ligne de la LIP (le prototype utilise des données fictives)')}
      </Txt>
    </Card>
  );
}

/** Compact inline status pill for the home screen. */
export function LicenceStatusPill({ status }: { status?: LicenceStatus }) {
  const c = useTheme();
  const { pick } = useI18n();
  const display = status?.display ?? 'unchecked';
  const tone = LICENCE_STATUS_TONE[display];
  const color = tone === 'success' ? c.success : tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.textMuted;
  const bg = tone === 'success' ? c.successBg : tone === 'danger' ? c.dangerBg : tone === 'warning' ? c.warningBg : c.surfaceAlt;
  const icon = display === 'valid' ? 'shield-checkmark' : display === 'expired' ? 'time' : display === 'unchecked' ? 'sync' : 'alert-circle';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Ionicons name={icon as IconName} size={14} color={color} />
      <Text style={{ color, fontFamily: fonts.semibold, fontSize: 12.5 }}>{pick(LICENCE_STATUS_LABEL[display])}</Text>
    </View>
  );
}
