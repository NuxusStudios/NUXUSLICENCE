import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Accordion, Bullets, Check, Chip, ChipRow, NumberedSteps, ResultPanel, Steps } from '../../components/kit';
import { Badge, Button, Card, Divider, ErrorState, Field, IconTile, Notice, Row, Screen, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { CATEGORY_ICON } from '../../lib/icons';
import { ORGANIZATIONS, serviceById, type ServiceRequest } from '../../lib/shared/platform';
import { fonts, space, useTheme } from '../../lib/theme';

const CORRECTABLE = [
  ['name', 'Name', 'Nom'],
  ['address', 'Address', 'Adresse'],
  ['dob', 'Date of birth', 'Date de naissance'],
  ['sex', 'Sex', 'Sexe'],
  ['height', 'Height', 'Taille'],
  ['class', 'Class', 'Catégorie'],
  ['conditions', 'Conditions', 'Conditions'],
] as const;

/**
 * Service card (Sanad): what the service is, where it's available, fees,
 * steps, conditions and documents, then a step-by-step application.
 */
export default function ServiceCard() {
  const { id, credentialId } = useLocalSearchParams<{ id: string; credentialId?: string }>();
  const c = useTheme();
  const { tr, pick, lang } = useI18n();
  const { status } = useAuth();
  const navigation = useNavigation();
  const service = serviceById(id);
  const [step, setStep] = useState(-1); // -1: the card itself
  const [values, setValues] = useState<Record<string, string>>(credentialId ? { credentialId } : {});
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<ServiceRequest>();

  useEffect(() => {
    if (service) navigation.setOptions({ title: step < 0 ? '' : pick(service.name) });
  }, [service, navigation, pick, step]);

  if (!service) return <ErrorState error={new Error(tr('Service not found', 'Service introuvable'))} onRetry={() => router.back()} />;
  const org = ORGANIZATIONS.find((o) => o.id === service.orgId)!;
  const correction = service.id === 'document-correction';
  const fields = correction ? service.fields.filter((f) => f.key === 'details') : service.fields;
  const steps = [tr('Details', 'Détails'), tr('Declaration', 'Déclaration'), tr('Review', 'Vérification')];
  const complete = fields.every((f) => !f.required || values[f.key]?.trim()) && (!correction || !!values.fields);
  const channel = { app: tr('Mobile app', 'Application mobile'), web: tr('Website', 'Site Web'), in_person: tr('In person', 'En personne') };

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      setDone(await api.submitService(service!.id, { data: values }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // --- submitted --------------------------------------------------------------
  if (done) {
    const awaiting = done.status === 'awaiting_payment';
    return (
      <Screen>
        <ResultPanel
          title={done.status === 'completed' ? tr('Done', 'C’est fait') : tr('Request submitted', 'Demande soumise')}
          subtitle={awaiting ? tr('Pay the fee to start processing. You can also pay later from My requests.', 'Payez les frais pour lancer le traitement. Vous pouvez aussi payer plus tard dans Mes demandes.') : undefined}
          icon={awaiting ? 'time' : 'checkmark'}
          tone={awaiting ? 'warning' : 'success'}
        />
        <Card style={{ paddingVertical: space.md }}>
          <Row label={tr('Application ID', 'Numéro de demande')} value={done.reference} mono />
          <Row label={tr('Service', 'Service')} value={pick(service.name)} />
          <Row label={tr('Amount', 'Montant')} value={done.amount ? money(done.amount, lang) : tr('Free', 'Gratuit')} />
          <Row label={tr('Status', 'Statut')} value={<Badge label={awaiting ? tr('Awaiting payment', 'Paiement attendu') : done.status === 'completed' ? tr('Completed', 'Terminée') : tr('In review', 'En traitement')} tone={awaiting ? 'warning' : 'success'} />} />
        </Card>
        {awaiting && (
          <Button
            title={`${tr('Pay now', 'Payer maintenant')} · ${money(done.amount, lang)}`}
            icon="card"
            onPress={() => router.replace({ pathname: '/pay', params: { kind: 'request', id: done.id, amount: String(done.amount), label: pick(service.name) } })}
          />
        )}
        <Button title={tr('View request', 'Voir la demande')} variant={awaiting ? 'secondary' : 'primary'} onPress={() => router.replace(`/requests/${done.id}`)} />
      </Screen>
    );
  }

  // --- the service card -------------------------------------------------------
  if (step < 0) {
    return (
      <Screen>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <IconTile icon={CATEGORY_ICON[service.category]} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="title" accessibilityRole="header">
              {pick(service.name)}
            </Txt>
            <Txt v="caption" muted>
              {pick(org.name)}
            </Txt>
          </View>
        </View>
        <ChipRow>
          {service.online && <Badge label={tr('Available online', 'Offert en ligne')} tone="success" />}
          {service.isNew && <Badge label={tr('New', 'Nouveau')} tone="info" />}
          <Badge label={service.processingDays ? tr(`About ${service.processingDays} business days`, `Environ ${service.processingDays} jours ouvrables`) : tr('Instant', 'Immédiat')} />
        </ChipRow>

        <Card style={{ gap: space.xs }}>
          <Txt v="label" muted>
            {tr('About this service', 'À propos de ce service')}
          </Txt>
          <Txt v="body">{pick(service.description)}</Txt>
          <Divider />
          <Txt v="label" muted style={{ marginTop: space.sm }}>
            {tr('Available on', 'Offert sur')}
          </Txt>
          <ChipRow>
            {service.channels.map((ch) => (
              <Badge key={ch} label={channel[ch]} tone="info" />
            ))}
          </ChipRow>
        </Card>

        <Card style={{ paddingVertical: space.xs }}>
          <Accordion title={tr('Fees', 'Frais')} icon="cash-outline" initiallyOpen>
            {service.feeBreakdown?.length ? (
              <>
                {service.feeBreakdown.map((f) => (
                  <Row key={f.label.en} label={pick(f.label)} value={money(f.amount, lang)} />
                ))}
                <Divider />
                <Row label={tr('Total', 'Total')} value={money(service.fee, lang)} strong />
              </>
            ) : (
              <Txt v="callout">{service.fee ? money(service.fee, lang) : tr('No fee', 'Aucuns frais')}</Txt>
            )}
            <Txt v="caption" faint>
              {tr('Prototype: fees are placeholders.', 'Prototype : les frais sont fictifs.')}
            </Txt>
          </Accordion>
          <Divider />
          <Accordion title={tr('Steps', 'Étapes')} icon="list-outline">
            <NumberedSteps items={service.steps.map(pick)} />
          </Accordion>
          {service.conditions.length > 0 && (
            <>
              <Divider />
              <Accordion title={tr('Conditions', 'Conditions')} icon="checkmark-done-outline">
                <Bullets items={service.conditions.map(pick)} />
              </Accordion>
            </>
          )}
          <Divider />
          <Accordion title={tr('Required documents', 'Documents requis')} icon="folder-open-outline">
            <Bullets items={service.documents.map(pick)} />
          </Accordion>
        </Card>

        {status === 'signedIn' ? (
          service.link ? (
            <Button title={tr('Start service', 'Commencer')} icon="arrow-forward" onPress={() => router.push(service.link as never)} />
          ) : (
            <Button title={tr('Start service', 'Commencer')} icon="arrow-forward" onPress={() => setStep(0)} />
          )
        ) : (
          <>
            <Notice tone="info">{tr('Sign in to apply. You can read every service card as a guest.', 'Connectez-vous pour faire une demande. Les fiches de service sont accessibles aux invités.')}</Notice>
            <Button title={tr('Sign in to start', 'Se connecter pour commencer')} icon="log-in-outline" onPress={() => router.push('/sign-in')} />
          </>
        )}
        {service.bookable && status === 'signedIn' && (
          <Button title={tr('Book a visit', 'Prendre rendez-vous')} variant="secondary" icon="calendar-outline" onPress={() => router.push(`/appointments/book?service=${service.id === 'renew-licence' ? 'vision-test' : service.id}`)} />
        )}
      </Screen>
    );
  }

  // --- the application, step by step ------------------------------------------
  return (
    <Screen>
      <Steps steps={steps} current={step} />

      {step === 0 && (
        <>
          {correction && (
            <View style={{ gap: space.sm }}>
              <Txt v="caption" muted style={{ fontFamily: fonts.semibold }}>
                {tr('What needs updating?', 'Que faut-il mettre à jour?')}
              </Txt>
              <ChipRow>
                {CORRECTABLE.map(([k, en, fr]) => {
                  const list = (values.fields ?? '').split(',').filter(Boolean);
                  const on = list.includes(k);
                  return (
                    <Chip
                      key={k}
                      label={tr(en, fr)}
                      on={on}
                      onPress={() => setValues((v) => ({ ...v, fields: (on ? list.filter((x) => x !== k) : [...list, k]).join(',') }))}
                    />
                  );
                })}
              </ChipRow>
            </View>
          )}
          {fields.map((f) =>
            f.type === 'select' ? (
              <View key={f.key} style={{ gap: space.xs }}>
                <Txt v="caption" muted style={{ fontFamily: fonts.semibold }}>
                  {pick(f.label)}
                </Txt>
                <ChipRow>
                  {f.options!.map((o) => (
                    <Chip key={o} label={o} on={values[f.key] === o} onPress={() => setValues((v) => ({ ...v, [f.key]: o }))} />
                  ))}
                </ChipRow>
              </View>
            ) : (
              <Field
                key={f.key}
                label={`${pick(f.label)}${f.required ? '' : tr(' (optional)', ' (facultatif)')}`}
                value={values[f.key] ?? ''}
                onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
                placeholder={f.type === 'date' ? 'YYYY-MM-DD' : undefined}
                multiline={f.key === 'details'}
              />
            ),
          )}
          <Button title={tr('Next', 'Suivant')} onPress={() => setStep(1)} disabled={!complete} />
        </>
      )}

      {step === 1 && (
        <>
          <Card style={{ gap: space.md }}>
            <Txt v="headline">{tr('Declaration and data authorization', 'Déclaration et autorisation')}</Txt>
            <Check checked={declared} onToggle={() => setDeclared((d) => !d)}>
              {tr(
                `I confirm the information is correct and I authorize ${pick(org.name)} to retrieve and process my records for this request.`,
                `Je confirme que l’information est exacte et j’autorise ${pick(org.name)} à consulter et traiter mes dossiers pour cette demande.`,
              )}
            </Check>
          </Card>
          <Button title={tr('Next', 'Suivant')} onPress={() => setStep(2)} disabled={!declared} />
          <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(0)} />
        </>
      )}

      {step === 2 && (
        <>
          <Card style={{ paddingVertical: space.md }}>
            <Row label={tr('Service', 'Service')} value={pick(service.name)} />
            {correction && <Row label={tr('Information', 'Information')} value={values.fields} />}
            {fields.map((f) => (
              <Row key={f.key} label={pick(f.label)} value={values[f.key] || '—'} />
            ))}
            <Divider />
            <Row label={tr('Fee', 'Frais')} value={service.fee ? money(service.fee, lang) : tr('Free', 'Gratuit')} strong />
          </Card>
          {service.fee > 0 && <Notice tone="info">{tr('You’ll pay after submitting. The request waits in “Awaiting payment” until then.', 'Vous paierez après la soumission. La demande reste « Paiement attendu » d’ici là.')}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={tr('Submit request', 'Soumettre la demande')} icon="send" onPress={submit} loading={busy} />
          <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(1)} />
        </>
      )}
      <Txt v="caption" faint style={{ textAlign: 'center', color: c.textFaint }}>
        {pick(org.name)}
      </Txt>
    </Screen>
  );
}
