import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Chip, ChipRow, ResultPanel } from '../../components/kit';
import { Button, Card, Field, Notice, Row, Screen, Segmented, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { FEEDBACK_TOPICS } from '../../lib/shared/platform';
import { space } from '../../lib/theme';

type Kind = 'suggestion' | 'complaint' | 'new_service';

/** Suggestions & complaints, and "request a new service" (Sanad). */
export default function Feedback() {
  const params = useLocalSearchParams<{ kind?: Kind }>();
  const { tr, pick } = useI18n();
  const [kind, setKind] = useState<Kind>(params.kind ?? 'suggestion');
  const [topic, setTopic] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reference, setReference] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.feedback({ kind, topic: kind === 'new_service' ? undefined : topic, message: message.trim() });
      setReference(res.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <Screen>
        <ResultPanel
          title={tr('Thank you', 'Merci')}
          subtitle={
            kind === 'complaint'
              ? tr('We’re sorry about the problem. We’ll follow up as soon as possible.', 'Nous sommes désolés du problème. Nous ferons un suivi au plus vite.')
              : kind === 'new_service'
                ? tr('Your suggestion goes to the ministry responsible.', 'Votre suggestion est transmise au ministère responsable.')
                : tr('Thanks for helping us improve.', 'Merci de nous aider à nous améliorer.')
          }
        />
        <Card style={{ paddingVertical: space.md }}>
          <Row label={tr('Reference', 'Référence')} value={reference} mono />
        </Card>
        <Button title={tr('Close', 'Fermer')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const valid = message.trim().length >= 10 && (kind === 'new_service' || !!topic);
  return (
    <Screen>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'suggestion', label: tr('Suggestion', 'Suggestion') },
          { value: 'complaint', label: tr('Complaint', 'Plainte') },
          { value: 'new_service', label: tr('New service', 'Nouveau service') },
        ]}
      />
      <Txt v="callout" muted>
        {kind === 'suggestion'
          ? tr('Share your ideas to help us improve our services.', 'Proposez vos idées pour améliorer nos services.')
          : kind === 'complaint'
            ? tr('Ran into a problem? Tell us the details.', 'Vous avez eu un problème? Donnez-nous les détails.')
            : tr('Can’t find the service you need? Suggest it and we’ll pass it on.', 'Vous ne trouvez pas le service voulu? Suggérez-le et nous le transmettrons.')}
      </Txt>
      {kind !== 'new_service' && (
        <>
          <Txt v="label" muted>
            {tr('Topic', 'Sujet')}
          </Txt>
          <ChipRow>
            {FEEDBACK_TOPICS.map((t) => (
              <Chip key={t.id} label={pick(t.label)} on={topic === t.id} onPress={() => setTopic(t.id)} />
            ))}
          </ChipRow>
        </>
      )}
      <Field
        label={kind === 'new_service' ? tr('What service would you like to add?', 'Quel service aimeriez-vous ajouter?') : tr('Tell us more', 'Dites-nous en plus')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }}
      />
      <Txt v="caption" faint>
        {message.trim().length}/1000 · {tr('at least 10 characters', 'au moins 10 caractères')}
      </Txt>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button title={tr('Submit', 'Envoyer')} icon="send" onPress={submit} loading={busy} disabled={!valid} />
    </Screen>
  );
}
