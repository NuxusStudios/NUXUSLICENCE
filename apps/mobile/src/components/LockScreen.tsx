import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { space, useTheme } from '../lib/theme';
import { Button } from './ui';

export function LockScreen() {
  const { unlock, signOut } = useAuth();
  const { t } = useI18n();
  const c = useTheme();

  useEffect(() => {
    void unlock();
  }, [unlock]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: c.bg }}>
      <Ionicons name="lock-closed" size={56} color={c.primary} />
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{t('unlockTitle')}</Text>
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        <Button title={t('unlock')} icon="finger-print" onPress={() => void unlock()} />
        <Button title={t('signOut')} variant="ghost" onPress={() => void signOut()} />
      </View>
    </View>
  );
}
