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

/** Colourful emoji glyphs for the Sanad-style service category grid. */
export const CATEGORY_EMOJI: Record<ServiceCategory, string> = {
  driver: '🪪',
  vehicle: '🚗',
  identity: '🧑',
  health: '🏥',
  records: '📑',
  courts: '⚖️',
};

/** Where a service opens: its own screen, or the generic service card. */
export const serviceHref = (s: { id: string; link?: string }) => (s.link ?? `/services/${s.id}`) as never;
