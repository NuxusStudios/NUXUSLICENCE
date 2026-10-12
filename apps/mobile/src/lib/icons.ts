import type { IconName } from '../components/ui';
import type { ServiceCategory } from './shared/platform';

export const CATEGORY_ICON: Record<ServiceCategory, IconName> = {
  driver: 'car-sport',
  vehicle: 'car',
  identity: 'person',
  health: 'medkit',
  records: 'document-text',
  courts: 'scale',
};

/** Where a service opens: its own screen, or the generic service card. */
export const serviceHref = (s: { id: string; link?: string }) => (s.link ?? `/services/${s.id}`) as never;
