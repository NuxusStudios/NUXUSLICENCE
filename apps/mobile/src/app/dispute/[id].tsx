import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Field, Notice, Screen, Title } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';

export default function Dispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { t } = useI18n();
  const [option, setOption] = useState<'early_resolution' | 'trial'>('early_resolution');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reference, setReference] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const fine = await api.disputeFine(id, { option, reason });
      setReference(fine.dispute?.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <Screen>
        <Notice tone="success">
          {t('disputeSent')} {reference}
        </Notice>
        <Button title={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const choices = [
    { key: 'early_resolution' as const, title: t('earlyResolution'), body: t('earlyResolutionBody') },
    { key: 'trial' as const, title: t('trial'), body: t('trialBody') },
  ];

  return (
    <Screen>
      <Title>{t('disputeTitle')}</Title>
      {choices.map((ch) => (
        <Pressable
          key={ch.key}
          onPress={() => setOption(ch.key)}
          accessibilityRole="radio"
          accessibilityState={{ checked: option === ch.key }}
          style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 2, borderColor: option === ch.key ? c.primary : c.border, backgroundColor: c.surface }}
        >
          <Ionicons name={option === ch.key ? 'radio-button-on' : 'radio-button-off'} size={22} color={c.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{ch.title}</Text>
            <Body muted>{ch.body}</Body>
          </View>
        </Pressable>
      ))}
      <Field label={t('disputeReason')} value={reason} onChangeText={setReason} multiline style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={t('submit')} onPress={submit} loading={busy} disabled={reason.trim().length < 10} />
    </Screen>
  );
}
