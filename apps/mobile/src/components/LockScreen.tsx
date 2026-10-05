import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { space, useTheme } from '../lib/theme';
import { Button, IconTile, Txt } from './ui';

export function LockScreen() {
  const { unlock, signOut } = useAuth();
  const { t } = useI18n();
  const c = useTheme();

  useEffect(() => {
    void unlock();
  }, [unlock]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: c.bg }}>
      <IconTile icon="lock-closed" size={72} />
      <Txt v="title">{t('unlockTitle')}</Txt>
      <View style={{ alignSelf: 'stretch', gap: space.sm, marginTop: space.lg }}>
        <Button title={t('unlock')} icon="finger-print" onPress={() => void unlock()} />
        <Button title={t('signOut')} variant="ghost" size="md" onPress={() => void signOut()} />
      </View>
    </View>
  );
}
