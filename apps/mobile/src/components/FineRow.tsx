import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { date, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space, useTheme } from '../lib/theme';
import type { Fine, FineSource, FineStatus } from '../lib/types';
import { Badge, IconTile, PressScale, Txt, type IconName } from './ui';

export const FINE_ICON: Record<FineSource, IconName> = {
  red_light_camera: 'videocam',
  speed_camera: 'speedometer',
  parking: 'car',
  officer_issued: 'shield-checkmark',
};

export function fineTone(status: FineStatus): 'danger' | 'warning' | 'success' | 'neutral' | 'info' {
  switch (status) {
    case 'overdue':
      return 'danger';
    case 'outstanding':
      return 'warning';
    case 'paid':
      return 'success';
    case 'disputed':
      return 'info';
    default:
      return 'neutral';
  }
}

export function FineRow({ fine }: { fine: Fine }) {
  const c = useTheme();
  const { t, lang } = useI18n();
  const open = fine.status === 'outstanding' || fine.status === 'overdue';
  return (
    <PressScale
      onPress={() => router.push(`/fine/${fine.id}`)}
      accessibilityLabel={`${t(fine.source)}, ${money(fine.total, lang)}, ${fine.status === 'overdue' ? t('overdue') : t(fine.status)}`}
      scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}
    >
      <IconTile icon={FINE_ICON[fine.source]} tone={fine.status === 'overdue' ? 'danger' : open ? 'warning' : fine.status === 'paid' ? 'success' : undefined} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt v="strong" numberOfLines={1}>
          {t(fine.source)}
        </Txt>
        <Txt v="caption" muted numberOfLines={1}>
          {fine.plate ? `${fine.plate} · ` : ''}
          {open ? `${t('due')} ${date(fine.dueDate, lang)}` : date(fine.occurredAt, lang)}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Txt v="strong" style={{ fontVariant: ['tabular-nums'] }} color={fine.status === 'overdue' ? c.danger : c.text}>
          {money(fine.total, lang)}
        </Txt>
        <Badge label={fine.status === 'overdue' ? t('overdue') : t(fine.status)} tone={fineTone(fine.status)} />
      </View>
      <Ionicons name="chevron-forward" size={17} color={c.textFaint} />
    </PressScale>
  );
}
