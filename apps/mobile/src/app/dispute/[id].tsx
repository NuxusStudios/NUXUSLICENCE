import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, IconTile, Notice, PressScale, Screen, Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';

export default function Dispute() {
  const params = useLocalSearchParams<{ id: string; option?: string }>();
  const id = params.id;
  const c = useTheme();
  const { t } = useI18n();
  const [option, setOption] = useState<'early_resolution' | 'trial'>(params.option === 'trial' ? 'trial' : 'early_resolution');
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
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <IconTile icon="checkmark" tone="success" size={84} />
          <Txt v="title" style={{ textAlign: 'center' }}>
            {t('disputeSent')}
          </Txt>
          <Txt v="mono" muted>
            {reference}
          </Txt>
        </View>
        <Button title={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const choices: { key: 'early_resolution' | 'trial'; icon: IconName; title: string; body: string }[] = [
    { key: 'early_resolution', icon: 'people', title: t('earlyResolution'), body: t('earlyResolutionBody') },
    { key: 'trial', icon: 'hammer', title: t('trial'), body: t('trialBody') },
  ];

  return (
    <Screen>
      <Txt v="title" accessibilityRole="header">
        {t('disputeTitle')}
      </Txt>
      {choices.map((ch) => {
        const on = option === ch.key;
        return (
          <PressScale
            key={ch.key}
            onPress={() => setOption(ch.key)}
            accessibilityRole="radio"
            accessibilityLabel={ch.title}
            accessibilityState={{ checked: on }}
            scaleTo={0.985}
            style={{
              flexDirection: 'row',
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderColor: on ? c.accent : c.border,
              backgroundColor: on ? c.primarySoft : c.surface,
            }}
          >
            <IconTile icon={ch.icon} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="strong">{ch.title}</Txt>
              <Txt v="caption" muted>
                {ch.body}
              </Txt>
            </View>
            <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? c.accent : c.textFaint} />
          </PressScale>
        );
      })}
      <Field label={t('disputeReason')} value={reason} onChangeText={setReason} multiline style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={t('submit')} onPress={submit} loading={busy} disabled={reason.trim().length < 10} />
    </Screen>
  );
}
