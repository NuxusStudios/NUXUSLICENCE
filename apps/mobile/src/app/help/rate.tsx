import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Chip, ChipRow, ResultPanel } from '../../components/kit';
import { Button, Card, Field, Notice, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { IMPROVEMENT_AREAS } from '../../lib/shared/platform';
import { space, useTheme } from '../../lib/theme';

const FACES = ['😞', '🙁', '😐', '🙂', '😄'];

/** Rate your experience (Sanad rating card / CX survey). */
export default function Rate() {
  const c = useTheme();
  const { tr, pick } = useI18n();
  const [rating, setRating] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const labels = [tr('Very dissatisfied', 'Très insatisfait'), tr('Dissatisfied', 'Insatisfait'), tr('Neutral', 'Neutre'), tr('Satisfied', 'Satisfait'), tr('Very satisfied', 'Très satisfait')];

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await api.feedback({ kind: 'rating', rating, improvements: areas, message: note.trim() || undefined });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <ResultPanel title={tr('Thank you!', 'Merci!')} subtitle={tr('We’re continuously working to improve our services.', 'Nous travaillons sans cesse à améliorer nos services.')} />
        <Button title={tr('Close', 'Fermer')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card style={{ gap: space.md, alignItems: 'center' }}>
        <Txt v="headline">{tr('How was your experience?', 'Comment s’est passée votre expérience?')}</Txt>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {FACES.map((f, i) => (
            <Pressable
              key={f}
              onPress={() => setRating(i + 1)}
              accessibilityRole="radio"
              accessibilityLabel={labels[i]}
              accessibilityState={{ checked: rating === i + 1 }}
              style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: rating === i + 1 ? c.accent : 'transparent', backgroundColor: rating === i + 1 ? c.primarySoft : c.surfaceAlt }}
            >
              <Text style={{ fontSize: 26 }}>{f}</Text>
            </Pressable>
          ))}
        </View>
        <Txt v="caption" muted>
          {rating ? labels[rating - 1] : ' '}
        </Txt>
      </Card>
      {rating > 0 && rating < 5 && (
        <>
          <Txt v="label" muted>
            {tr('What can be improved?', 'Que pouvons-nous améliorer?')}
          </Txt>
          <ChipRow>
            {IMPROVEMENT_AREAS.map((a) => (
              <Chip key={a.id} label={pick(a.label)} on={areas.includes(a.id)} onPress={() => setAreas((xs) => (xs.includes(a.id) ? xs.filter((x) => x !== a.id) : [...xs, a.id]))} />
            ))}
          </ChipRow>
        </>
      )}
      <Field label={tr('Add a note (optional)', 'Ajouter une note (facultatif)')} value={note} onChangeText={setNote} multiline maxLength={1000} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={tr('Submit rating', 'Envoyer l’évaluation')} icon="star" disabled={!rating} loading={busy} onPress={submit} />
    </Screen>
  );
}
