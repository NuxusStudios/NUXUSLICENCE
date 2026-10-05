import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { Button, Card, Divider, ErrorState, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { QR_REFRESH_SECONDS } from '../../lib/config';
import { date } from '../../lib/format';
import { useI18n, type TKey } from '../../lib/i18n';
import { fonts, radius, space, useTheme } from '../../lib/theme';
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
      <Card style={{ paddingVertical: space.md }}>
        <Row label={t('status')} value={t(cred.status)} />
        <Row label={t('issued')} value={date(cred.issuedOn, lang)} />
        <Row label={t('expires')} value={date(cred.expiresOn, lang)} />
        {cred.licenceClass && <Row label={t('class')} value={cred.licenceClass} />}
        {cred.conditions?.length ? <Row label={t('conditions')} value={cred.conditions.join('\n')} /> : null}
        {cred.vehicle ? (
          <>
            <Row label={t('plate')} value={cred.vehicle.plate} mono />
            <Row label={t('vin')} value={cred.vehicle.vin} mono />
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
    <Card style={{ gap: space.md }}>
      <Txt v="headline">{t('whatToShare')}</Txt>
      <View>
        {options.map((o, i) => {
          const on = disclosure === o;
          return (
            <View key={o}>
              {i > 0 && <Divider inset={34} />}
              <Pressable
                onPress={() => choose(o)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 }}
              >
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? c.accent : c.textFaint} />
                <Txt v={on ? 'strong' : 'callout'}>{t(`disclosure_${o}` as TKey)}</Txt>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* The code sits on white in both themes so any scanner can read it. */}
      <View style={{ alignItems: 'center', padding: space.xl, backgroundColor: '#FFFFFF', borderRadius: radius.lg, minHeight: 300, justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
        {error ? <Txt v="callout" color={c.danger}>{error}</Txt> : token ? <QRCode value={token} size={240} ecl="L" color="#0D1522" /> : <ActivityIndicator color="#5F6B7D" />}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, justifyContent: 'center' }} accessibilityLiveRegion="polite">
        <CountdownRing remaining={remaining} total={QR_REFRESH_SECONDS} />
        <Txt v="callout" muted>
          {t('qrExpiresIn')} {remaining}
          {t('seconds')}
        </Txt>
      </View>
      <Txt v="caption" muted style={{ textAlign: 'center' }}>
        {t('qrHelp')}
      </Txt>
      <Button title={t('done')} variant="secondary" onPress={onClose} />
    </Card>
  );
}

/** Small ring that empties as the QR code approaches its refresh. */
function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const c = useTheme();
  const r = 11;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, remaining / total));
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={28} height={28} viewBox="0 0 28 28" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={14} cy={14} r={r} stroke={c.border} strokeWidth={3} fill="none" />
        <Circle cx={14} cy={14} r={r} stroke={frac < 0.2 ? c.warning : c.accent} strokeWidth={3} fill="none" strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - frac)} strokeLinecap="round" />
      </Svg>
      <Txt v="caption" style={{ fontFamily: fonts.bold, fontSize: 9 }}>
        {remaining}
      </Txt>
    </View>
  );
}
