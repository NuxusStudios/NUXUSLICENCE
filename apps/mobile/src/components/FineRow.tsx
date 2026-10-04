import { router } from 'expo-router';
import { date, money } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { Fine, FineSource, FineStatus } from '../lib/types';
import { Badge, ListItem, type IconName } from './ui';

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
  const { t, lang } = useI18n();
  const open = fine.status === 'outstanding' || fine.status === 'overdue';
  return (
    <ListItem
      icon={FINE_ICON[fine.source]}
      tone={fine.status === 'overdue' ? 'danger' : open ? 'warning' : undefined}
      title={`${t(fine.source)} · ${money(fine.total, lang)}`}
      subtitle={`${fine.plate ? `${fine.plate} · ` : ''}${open ? `${t('due')} ${date(fine.dueDate, lang)}` : date(fine.occurredAt, lang)}`}
      right={<Badge label={fine.status === 'overdue' ? t('overdue') : t(fine.status)} tone={fineTone(fine.status)} />}
      onPress={() => router.push(`/fine/${fine.id}`)}
    />
  );
}
