import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Field, Notice, Row, Screen } from '../components/ui';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { useI18n, type TKey } from '../lib/i18n';
import { radius, space, useTheme } from '../lib/theme';
import type { VerifyResult } from '../lib/types';

const CLAIM_LABEL: Record<string, TKey> = {
  givenNames: 'givenNames',
  surname: 'surname',
  ageOver19: 'ageOver19',
  ageOver18: 'ageOver18',
  photo: 'photoShown',
  dateOfBirth: 'dateOfBirth',
  documentNumber: 'licenceNumber',
  licenceClass: 'class',
  conditions: 'conditions',
  expiresOn: 'expires',
  issuedOn: 'issued',
  address: 'address',
  sex: 'sex',
  heightCm: 'height',
  status: 'status',
};

/**
 * Verifier mode, for police, retailers, landlords, banks. Scans a holder's QR,
 * checks it with the issuer, and shows only the claims the holder chose to share.
 */
export default function Verify() {
  const c = useTheme();
  const { t, lang } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState('');
  const [verifier, setVerifier] = useState('');
  const [result, setResult] = useState<VerifyResult>();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  async function verify(value: string) {
    setBusy(true);
    setResult(undefined);
    try {
      setResult(await api.verify(value.trim(), verifier.trim() || 'CivicPass verifier'));
    } catch (e) {
      setResult({ valid: false, reason: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function onScanned({ data }: { data: string }) {
    if (handled.current) return;
    handled.current = true;
    setScanning(false);
    setToken(data);
    void verify(data);
  }

  const canScan = Platform.OS !== 'web';

  return (
    <Screen>
      <Body muted>{t('verifyBody')}</Body>
      <Field label={t('verifierName')} value={verifier} onChangeText={setVerifier} placeholder="e.g. Example Police Service" />

      {canScan &&
        (scanning ? (
          permission?.granted ? (
            <View style={{ height: 320, borderRadius: radius.lg, overflow: 'hidden' }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
            </View>
          ) : (
            <Card>
              <Body>{t('cameraPermission')}</Body>
              <Button title={t('grantPermission')} onPress={() => void requestPermission()} />
            </Card>
          )
        ) : (
          <Button
            title={t('scanQr')}
            icon="scan"
            onPress={() => {
              handled.current = false;
              setScanning(true);
            }}
          />
        ))}

      <Field label={t('pasteToken')} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 70, fontSize: 12, paddingTop: 10 }} />
      <Button title={t('verifyNow')} variant="secondary" onPress={() => verify(token)} loading={busy} disabled={token.length < 20} />

      {result && (
        <Card style={{ borderColor: result.valid ? c.success : c.danger, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name={result.valid ? 'checkmark-circle' : 'close-circle'} size={36} color={result.valid ? c.success : c.danger} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: result.valid ? c.success : c.danger }}>{result.valid ? t('verified') : t('notVerified')}</Text>
          </View>
          {result.valid ? (
            <>
              {result.credentialType && <Row label="" value={t(result.credentialType)} strong />}
              {Object.entries(result.claims ?? {}).map(([k, v]) => (
                <Row key={k} label={CLAIM_LABEL[k] ? t(CLAIM_LABEL[k]).split(' (')[0]! : k} value={formatClaim(k, v, lang)} />
              ))}
              {result.claims?.photo === true && <Notice tone="info">Compare the person to the photo on their screen.</Notice>}
            </>
          ) : (
            <Notice tone="danger">{result.reason}</Notice>
          )}
        </Card>
      )}
    </Screen>
  );
}

function formatClaim(key: string, v: unknown, lang: 'en' | 'fr'): string {
  if (typeof v === 'boolean') return v ? '✓ Yes' : '✗ No';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('line1' in o) return `${o.line1}${o.line2 ? `, ${o.line2}` : ''}\n${o.city} ${o.province} ${o.postalCode}`;
    if ('plate' in o) return `${o.plate} · ${o.year} ${o.make} ${o.model}`;
    return JSON.stringify(v);
  }
  if (key === 'heightCm') return `${v} cm`;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && key !== 'documentNumber') return date(v, lang);
  return String(v);
}
