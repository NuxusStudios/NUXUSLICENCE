import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Notice, Row, Screen, SectionHeader, Txt } from '../components/ui';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { fonts, radius, space, useTheme } from '../lib/theme';
import type { SignatureRecord } from '../lib/types';
import { useAsync } from '../lib/useAsync';

// Example document. In production, documents arrive from a service workflow
// (e.g. a vehicle transfer) and are rendered from the issuing ministry's PDF.
const DOCUMENT = {
  title: 'Vehicle bill of sale (sample)',
  content: [
    'BILL OF SALE — SAMPLE',
    'Seller: the account holder.',
    'Buyer: licence L4321-09876-50302.',
    'Vehicle: 2021 Honda Civic, VIN 1HGCV1F30LA000001.',
    'Sale price: $18,500.00 CAD. Sold as-is.',
    'Both parties confirm the information above is true.',
  ].join('\n'),
};

export default function Sign() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [signed, setSigned] = useState<SignatureRecord>();
  const history = useAsync(api.signatures);

  async function sign() {
    setBusy(true);
    setError(undefined);
    try {
      setSigned(await api.sign({ documentTitle: DOCUMENT.title, documentContent: DOCUMENT.content, consent: true }));
      void history.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt v="body" muted>
        {t('signBody')}
      </Txt>

      {/* The document, as a sheet of paper (white in both themes) with its signature line. */}
      <View style={[styles.paper, { boxShadow: c.shadowStrong }]}>
        <Text style={styles.paperTitle}>{DOCUMENT.title}</Text>
        <View style={styles.rule} />
        <Text style={styles.paperBody}>{DOCUMENT.content}</Text>
        <View style={{ marginTop: space.xl, gap: 6 }}>
          {signed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons name="shield-checkmark" size={18} color="#12795A" />
              <Text style={styles.signedName}>{t('signedAt')} {dateTime(signed.signedAt, lang)}</Text>
            </View>
          ) : (
            <Text style={styles.placeholder}>×</Text>
          )}
          <View style={styles.signLine} />
          <Text style={styles.signCaption}>{t('signTitle')}</Text>
        </View>
      </View>

      {signed ? (
        <Card style={{ gap: space.sm }}>
          <Notice tone="success">
            {t('signedAt')} {dateTime(signed.signedAt, lang)}
          </Notice>
          <Txt v="label" muted>
            {t('fingerprint')}
          </Txt>
          <Text selectable style={{ color: c.textMuted, fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 17 }}>
            {signed.documentSha256}
          </Text>
        </Card>
      ) : (
        <>
          <Pressable
            onPress={() => setConsent((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingHorizontal: 2 }}
          >
            <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={consent ? c.accent : c.textFaint} />
            <Txt v="callout" style={{ flex: 1 }}>
              {t('signConsent')}
            </Txt>
          </Pressable>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={t('signNow')} icon="create" onPress={sign} loading={busy} disabled={!consent} />
        </>
      )}

      {!!history.data?.length && (
        <View style={{ gap: space.lg }}>
          <SectionHeader>{t('signedAt')}</SectionHeader>
          <Card style={{ paddingVertical: space.md }}>
            {history.data.map((s) => (
              <Row key={s.id} label={s.documentTitle} value={dateTime(s.signedAt, lang)} />
            ))}
          </Card>
        </View>
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
  signedName: { color: '#12795A', fontFamily: fonts.semibold, fontSize: 14 },
  signLine: { height: 1, backgroundColor: '#0D1522', opacity: 0.6 },
  signCaption: { color: '#5F6B7D', fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});
