import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { Body, Button, Card, ErrorState, Loading, Notice, Row, Screen, SectionHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { QR_REFRESH_SECONDS } from '../../lib/config';
import { date } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';
import type { Credential, Disclosure } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

function disclosuresFor(c: Credential): Disclosure[] {
  if (c.type === 'vehicle_permit') return ['full'];
  if (c.type === 'driver_licence') return ['full', 'licence_status', 'age_over_19', 'age_over_18', 'name_photo'];
  return ['full', 'age_over_19', 'age_over_18', 'name_photo'];
}

export default function CredentialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(() => api.credential(id), id);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (data) navigation.setOptions({ title: t(data.type) });
  }, [data, navigation, t]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const cred = data!;
  const h = cred.holder;

  return (
    <Screen>
      <DocumentCard credential={cred} />
      {cred.status !== 'valid' && <Notice tone="danger">{t(cred.status)}</Notice>}

      {sharing ? (
        <Presentation credential={cred} onClose={() => setSharing(false)} />
      ) : (
        <Button title={t('showQr')} icon="qr-code" onPress={() => setSharing(true)} disabled={cred.status !== 'valid'} />
      )}

      <SectionHeader>{t('status')}</SectionHeader>
      <Card>
        <Row label={t('status')} value={t(cred.status)} />
        <Row label={t('issued')} value={date(cred.issuedOn, lang)} />
        <Row label={t('expires')} value={date(cred.expiresOn, lang)} />
        {cred.licenceClass && <Row label={t('class')} value={cred.licenceClass} />}
        {cred.conditions?.length ? <Row label={t('conditions')} value={cred.conditions.join('\n')} /> : null}
        {cred.vehicle ? (
          <>
            <Row label={t('plate')} value={cred.vehicle.plate} />
            <Row label={t('vin')} value={cred.vehicle.vin} />
          </>
        ) : (
          <>
            <Row label={t('sex')} value={h.sex} />
            <Row label={t('height')} value={`${h.heightCm} cm`} />
          </>
        )}
        <Row label={t('address')} value={`${h.address.line1}${h.address.line2 ? `, ${h.address.line2}` : ''}\n${h.address.city} ${h.address.province} ${h.address.postalCode}`} />
      </Card>
    </Screen>
  );
}

function Presentation({ credential, onClose }: { credential: Credential; onClose: () => void }) {
  const c = useTheme();
  const { t } = useI18n();
  const options = disclosuresFor(credential);
  const [disclosure, setDisclosure] = useState<Disclosure>(options[0]!);
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [refreshAt, setRefreshAt] = useState(0);
  // Mirrors of state read from the interval callback.
  const refreshAtRef = useRef(0);
  const fetching = useRef(false);

  const fetchToken = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    let next: number;
    try {
      const res = await api.present(credential.id, disclosure);
      next = Date.now() + Math.min(QR_REFRESH_SECONDS, res.expiresInSeconds - 5) * 1000;
      setError(undefined);
      setToken(res.token);
    } catch (e) {
      next = Date.now() + 10_000;
      setToken(undefined);
      setError((e as Error).message);
    } finally {
      fetching.current = false;
    }
    refreshAtRef.current = next;
    setRefreshAt(next);
  }, [credential.id, disclosure]);

  // One ticking timer drives both the countdown and the refresh. A new
  // disclosure choice gives a new fetchToken, which restarts the cycle.
  useEffect(() => {
    refreshAtRef.current = 0;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() >= refreshAtRef.current) void fetchToken();
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [fetchToken]);

  const remaining = Math.max(0, Math.ceil((refreshAt - now) / 1000));

  function choose(d: Disclosure) {
    if (d === disclosure) return;
    setToken(undefined);
    setDisclosure(d);
  }

  return (
    <Card>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{t('whatToShare')}</Text>
      <View style={{ gap: space.xs }}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => choose(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: disclosure === o }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 }}
          >
            <Ionicons name={disclosure === o ? 'radio-button-on' : 'radio-button-off'} size={20} color={c.primary} />
            <Text style={{ color: c.text, fontSize: 15 }}>{t(`disclosure_${o}` as TKey)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: 'center', padding: space.lg, backgroundColor: '#fff', borderRadius: radius.md, minHeight: 280, justifyContent: 'center' }}>
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : token ? <QRCode value={token} size={250} ecl="L" /> : <ActivityIndicator />}
      </View>
      <Text style={{ color: c.textMuted, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {t('qrExpiresIn')} {remaining}
        {t('seconds')}
      </Text>
      <Body muted>{t('qrHelp')}</Body>
      <Button title={t('done')} variant="secondary" onPress={onClose} />
    </Card>
  );
}
