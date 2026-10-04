import { Text, View } from 'react-native';
import { IS_PROTOTYPE } from '../lib/config';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export function PrototypeBanner() {
  const c = useTheme();
  const { t } = useI18n();
  if (!IS_PROTOTYPE) return null;
  return (
    <View style={{ backgroundColor: c.dangerBg, paddingVertical: 4, alignItems: 'center' }} accessibilityRole="text">
      <Text style={{ color: c.danger, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{t('prototypeBanner')}</Text>
    </View>
  );
}
