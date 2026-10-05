import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Card, Field, Notice, Row, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { date } from '../lib/format';
import { useI18n, type TKey } from '../lib/i18n';
import { fonts, radius, space, useTheme } from '../lib/theme';
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
      <Txt v="body" muted>
        {t('verifyBody')}
      </Txt>
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

      <Field label={t('pasteToken')} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 80, fontSize: 12, paddingTop: 12, fontFamily: fonts.mono }} />
      <Button title={t('verifyNow')} variant="secondary" onPress={() => verify(token)} loading={busy} disabled={token.length < 20} />

      {result && (
        <Card flush style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: result.valid ? c.successBg : c.dangerBg }}>
            <Ionicons name={result.valid ? 'shield-checkmark' : 'close-circle'} size={40} color={result.valid ? c.success : c.danger} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="title" color={result.valid ? c.success : c.danger}>
                {result.valid ? t('verified') : t('notVerified')}
              </Txt>
              {result.valid && result.credentialType ? (
                <Txt v="callout" color={c.success}>
                  {t(result.credentialType)}
                </Txt>
              ) : null}
            </View>
          </View>
          <View style={{ padding: space.lg, paddingTop: space.md, gap: space.sm }}>
            {result.valid ? (
              <>
                {Object.entries(result.claims ?? {}).map(([k, v]) => (
                  <Row key={k} label={CLAIM_LABEL[k] ? t(CLAIM_LABEL[k]).split(' (')[0]! : k} value={formatClaim(k, v, lang)} mono={k === 'documentNumber'} />
                ))}
                {result.claims?.photo === true && <Notice tone="info">{t('comparePhoto')}</Notice>}
              </>
            ) : (
              <Txt v="mono" color={c.danger}>
                {result.reason}
              </Txt>
            )}
          </View>
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
