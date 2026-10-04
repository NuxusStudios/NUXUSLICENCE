import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Notice, Row, Screen, SectionHeader } from '../components/ui';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { space, useTheme } from '../lib/theme';
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
      <Body muted>{t('signBody')}</Body>
      <Card>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{DOCUMENT.title}</Text>
        <Text style={{ color: c.text, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}>{DOCUMENT.content}</Text>
      </Card>

      {signed ? (
        <Card>
          <Notice tone="success">
            {t('signedAt')} {dateTime(signed.signedAt, lang)}
          </Notice>
          <Row label={t('fingerprint')} value="" />
          <Text selectable style={{ color: c.textMuted, fontFamily: 'monospace', fontSize: 11 }}>
            {signed.documentSha256}
          </Text>
        </Card>
      ) : (
        <>
          <Pressable
            onPress={() => setConsent((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}
          >
            <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={24} color={c.primary} />
            <Text style={{ color: c.text, flex: 1, fontSize: 15, lineHeight: 21 }}>{t('signConsent')}</Text>
          </Pressable>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button title={t('signNow')} icon="create" onPress={sign} loading={busy} disabled={!consent} />
        </>
      )}

      {!!history.data?.length && (
        <View style={{ gap: space.sm }}>
          <SectionHeader>{t('signedAt')}</SectionHeader>
          <Card>
            {history.data.map((s) => (
              <Row key={s.id} label={s.documentTitle} value={dateTime(s.signedAt, lang)} />
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}
