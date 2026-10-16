import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, IconTile, Notice, PressScale, Screen, Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { disputeOptionsFor, type DisputeOption } from '../../lib/shared/parking';
import { radius, space, useTheme } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

const ICON: Record<DisputeOption, IconName> = { early_resolution: 'people', trial: 'hammer', screening_review: 'search', hearing: 'hammer' };

export default function Dispute() {
  const params = useLocalSearchParams<{ id: string; option?: string; source?: string }>();
  const id = params.id;
  const c = useTheme();
  const { t, tr, pick } = useI18n();
  // Source comes from the fine screen; for a deep link we look it up.
  const fine = useAsync(() => api.fine(id), id);
  const source = params.source ?? fine.data?.source;
  const choices = disputeOptionsFor(source ?? 'parking');
  const [option, setOption] = useState<DisputeOption | undefined>(params.option as DisputeOption | undefined);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reference, setReference] = useState<string>();
  const parking = source === 'parking';
  // Default/validate the selected option once we know the ticket's options.
  const selected = option && choices.some((o) => o.option === option) ? option : choices[0]!.option;

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const disputed = await api.disputeFine(id, { option: selected, reason });
      setReference(disputed.dispute?.reference);
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
          <Txt v="caption" muted style={{ textAlign: 'center' }}>
            {parking
              ? tr('The penalty office will notify you here with your date.', 'Le bureau des pénalités vous informera ici de votre date.')
              : tr('The court office will notify you here with your date.', 'Le bureau du tribunal vous informera ici de votre date.')}
          </Txt>
        </View>
        <Button title={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!source && fine.loading) {
    return (
      <Screen>
        <Txt v="title" accessibilityRole="header">
          {t('disputeTitle')}
        </Txt>
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt v="title" accessibilityRole="header">
        {parking ? tr('Respond to this penalty', 'Répondre à cette pénalité') : t('disputeTitle')}
      </Txt>
      {parking && (
        <Notice tone="info">
          {tr('Parking tickets follow the Administrative Penalty System: ask for a screening review first, then a hearing.', 'Les contraventions de stationnement relèvent du système de pénalités administratives : demandez d’abord une révision, puis une audience.')}
        </Notice>
      )}
      {choices.map((ch) => {
        const on = selected === ch.option;
        return (
          <PressScale
            key={ch.option}
            onPress={() => setOption(ch.option)}
            accessibilityRole="radio"
            accessibilityLabel={pick(ch.label)}
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
            <IconTile icon={ICON[ch.option]} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt v="strong">{pick(ch.label)}</Txt>
              <Txt v="caption" muted>
                {pick(ch.body)}
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
