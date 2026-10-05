import { Text, View } from 'react-native';
import { IS_PROTOTYPE } from '../lib/config';
import { useI18n } from '../lib/i18n';
import { fonts, useTheme } from '../lib/theme';

export function PrototypeBanner() {
  const c = useTheme();
  const { t } = useI18n();
  if (!IS_PROTOTYPE) return null;
  return (
    <View style={{ backgroundColor: c.dangerBg, paddingVertical: 5, alignItems: 'center' }} accessibilityRole="text">
      <Text style={{ color: c.danger, fontSize: 10.5, fontFamily: fonts.bold, letterSpacing: 1.1 }}>{t('prototypeBanner').toUpperCase()}</Text>
    </View>
  );
}
