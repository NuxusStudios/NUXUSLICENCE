import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Check, PinPad, SignaturePad, SignatureView, Steps } from '../components/kit';
import { Badge, Button, Card, Divider, Empty, ListItem, Notice, Row, Screen, Segmented, Txt } from '../components/ui';
import { api } from '../lib/api';
import { date, dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { SIGNABLE_DOCUMENTS, SIGNED_RETENTION_DAYS } from '../lib/shared/platform';
import { fonts, radius, space, useTheme } from '../lib/theme';
import type { SignatureRecord } from '../lib/types';
import { useAsync } from '../lib/useAsync';

/**
 * Digital signature (Sanad "My Signature"): choose a document, sign with a
 * drawn or saved signature, confirm with the digital ID PIN. In production,
 * documents arrive from a service workflow (e.g. a vehicle transfer).
 */
export default function Sign() {
  const c = useTheme();
  const { tr, pick, lang } = useI18n();
  const [tab, setTab] = useState<'new' | 'signed'>('new');
  const [step, setStep] = useState(0);
  const [docId, setDocId] = useState(SIGNABLE_DOCUMENTS[0]!.id);
  const [drawn, setDrawn] = useState('');
  const [useSaved, setUseSaved] = useState(true);
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const [signed, setSigned] = useState<SignatureRecord & { path: string }>();
  const history = useAsync(api.signatures);
  const saved = useAsync(api.savedSignature);
  const doc = SIGNABLE_DOCUMENTS.find((d) => d.id === docId)!;
  const savedPath = saved.data?.path ?? undefined;
  const path = useSaved && savedPath ? savedPath : drawn;
  const steps = [tr('Document', 'Document'), tr('Signature', 'Signature'), tr('Confirm', 'Confirmation')];

  async function sign(pin: string) {
    const record = await api.sign({ documentTitle: pick(doc.title), documentContent: doc.content, consent: true, pin });
    if (!(useSaved && savedPath) && remember) await api.saveSignature(drawn).catch(() => undefined);
    setSigned({ ...record, path });
    void history.reload();
    void saved.reload();
  }

  function restart() {
    setSigned(undefined);
    setStep(0);
    setConsent(false);
    setDrawn('');
  }

  const paper = (sig?: string) => (
    <View style={[styles.paper, { boxShadow: c.shadowStrong }]}>
      <Text style={styles.paperTitle}>{pick(doc.title)}</Text>
      <View style={styles.rule} />
      <Text style={styles.paperBody}>{doc.content}</Text>
      <View style={{ marginTop: space.lg, gap: 4 }}>
        {sig ? <SignatureView path={sig} height={56} /> : <Text style={styles.placeholder}>×</Text>}
        <View style={styles.signLine} />
        <Text style={styles.signCaption}>{tr('Signature', 'Signature')}</Text>
      </View>
    </View>
  );

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'new', label: tr('Sign a document', 'Signer un document') },
          { value: 'signed', label: `${tr('Signed', 'Signés')} (${history.data?.length ?? 0})` },
        ]}
      />

      {tab === 'signed' ? (
        <>
          <Notice tone="info">
            {tr(`Signed copies are deleted from our servers ${SIGNED_RETENTION_DAYS} days after signing. The fingerprint and signature stay as proof.`, `Les copies signées sont supprimées de nos serveurs ${SIGNED_RETENTION_DAYS} jours après la signature. L’empreinte et la signature restent comme preuve.`)}
          </Notice>
          <Card style={{ paddingVertical: space.xs }}>
            {!history.data?.length ? (
              <Empty icon="create-outline" text={tr('No signed documents yet.', 'Aucun document signé.')} />
            ) : (
              history.data.map((s, i) => (
                <View key={s.id}>
                  {i > 0 && <Divider inset={52} />}
                  <ListItem
                    icon="document-text"
                    tone="success"
                    title={s.documentTitle}
                    subtitle={`${dateTime(s.signedAt, lang)}${s.retainedUntil ? `\n${tr('Copy available until', 'Copie disponible jusqu’au')} ${date(s.retainedUntil, lang)}` : ''}`}
                    right={<Badge label={tr('Completed', 'Terminé')} tone="success" />}
                  />
                </View>
              ))
            )}
          </Card>
        </>
      ) : signed ? (
        <>
          {paper(signed.path)}
          <Card style={{ gap: space.sm }}>
            <Notice tone="success">
              {tr('Signed', 'Signé le')} {dateTime(signed.signedAt, lang)}
            </Notice>
            <Txt v="label" muted>
              {tr('Document fingerprint (SHA-256)', 'Empreinte du document (SHA-256)')}
            </Txt>
            <Text selectable style={{ color: c.textMuted, fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 17 }}>
              {signed.documentSha256}
            </Text>
            {signed.retainedUntil && <Row label={tr('Copy kept until', 'Copie conservée jusqu’au')} value={date(signed.retainedUntil, lang)} />}
          </Card>
          <Button title={tr('Sign another document', 'Signer un autre document')} variant="secondary" onPress={restart} />
        </>
      ) : (
        <>
          <Steps steps={steps} current={step} />
          {step === 0 && (
            <>
              {SIGNABLE_DOCUMENTS.map((d) => (
                <ListItem key={d.id} icon={docId === d.id ? 'radio-button-on' : 'radio-button-off'} title={pick(d.title)} onPress={() => setDocId(d.id)} />
              ))}
              {paper()}
              <Button title={tr('Next', 'Suivant')} onPress={() => setStep(1)} />
            </>
          )}
          {step === 1 && (
            <>
              {savedPath && (
                <Segmented
                  value={useSaved ? 'saved' : 'draw'}
                  onChange={(v) => setUseSaved(v === 'saved')}
                  options={[
                    { value: 'saved', label: tr('Saved signature', 'Signature enregistrée') },
                    { value: 'draw', label: tr('Draw new', 'Nouvelle signature') },
                  ]}
                />
              )}
              {useSaved && savedPath ? (
                <Card style={{ alignItems: 'center', backgroundColor: '#FFFFFF' }}>
                  <SignatureView path={savedPath} height={90} />
                </Card>
              ) : (
                <>
                  <SignaturePad value={drawn} onChange={setDrawn} />
                  <Check checked={remember} onToggle={() => setRemember((r) => !r)}>
                    {tr('Save my signature for next time', 'Enregistrer ma signature pour la prochaine fois')}
                  </Check>
                </>
              )}
              <Button title={tr('Next', 'Suivant')} onPress={() => setStep(2)} disabled={!path} />
              <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(0)} />
            </>
          )}
          {step === 2 && (
            <>
              {paper(path)}
              <Check checked={consent} onToggle={() => setConsent((v) => !v)}>
                {tr('I have read this document and I sign it electronically. This has the same effect as my handwritten signature.', 'J’ai lu ce document et je le signe électroniquement, avec le même effet que ma signature manuscrite.')}
              </Check>
              {consent && <PinPad title={tr('Enter your digital ID PIN to sign', 'Entrez votre NIP pour signer')} onComplete={sign} />}
              <Button title={tr('Back', 'Retour')} variant="ghost" size="md" onPress={() => setStep(1)} />
            </>
          )}
          <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: 2 }}>
            <Ionicons name="shield-checkmark-outline" size={15} color={c.textMuted} style={{ marginTop: 2 }} />
            <Txt v="caption" muted style={{ flex: 1 }}>
              {tr('The platform signs a fingerprint of the document on your behalf after you confirm with your PIN.', 'La plateforme signe une empreinte du document en votre nom après confirmation avec votre NIP.')}
            </Txt>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FFFFFF', borderRadius: radius.sm, padding: space.xl, gap: space.md },
  paperTitle: { color: '#0D1522', fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.2 },
  rule: { height: 1, backgroundColor: '#E2E6EC' },
  paperBody: { color: '#2A3442', fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 20 },
  placeholder: { color: '#8C96A6', fontFamily: fonts.medium, fontSize: 22 },
  signLine: { height: 1, backgroundColor: '#0D1522', opacity: 0.6 },
  signCaption: { color: '#5F6B7D', fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});
