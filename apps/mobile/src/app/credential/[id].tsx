import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { DocumentCard } from '../../components/DocumentCard';
import { VehiclePermitDocument } from '../../components/VehiclePermitDocument';
import { FlipCard } from '../../components/FlipCard';
import { LicenceStatusCard, Widget } from '../../components/kit';
import { Button, Card, Divider, ErrorState, ListItem, Loading, Notice, Row, Screen, SectionHeader, Txt } from '../../components/ui';
import { api } from '../../lib/api';
import { DEMO_MODE, QR_REFRESH_SECONDS } from '../../lib/config';
import { date } from '../../lib/format';
import { CATEGORY_ICON, serviceHref } from '../../lib/icons';
import { MAX_FAVOURITE_CARDS, serviceById } from '../../lib/shared/platform';
import { useI18n, type TKey } from '../../lib/i18n';
import { fonts, radius, space, useTheme } from '../../lib/theme';
import type { Credential, Disclosure } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

const RELATED: Record<Credential['type'], string[]> = {
  driver_licence: ['renew-licence', 'replace-licence', 'driver-record', 'change-address'],
  photo_card: ['photo-card', 'change-address'],
  health_card: ['renew-health-card', 'change-address'],
  vehicle_permit: ['renew-plate', 'replace-permit', 'transfer-vehicle', 'personalized-plates'],
};

function disclosuresFor(c: Credential): Disclosure[] {
  if (c.type === 'vehicle_permit') return ['full'];
  if (c.type === 'driver_licence') return ['full', 'licence_status', 'age_over_19', 'age_over_18', 'name_photo'];
  return ['full', 'age_over_19', 'age_over_18', 'name_photo'];
}

export default function CredentialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, tr, pick, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(() => api.credential(id), id);
  const prefs = useAsync(api.preferences);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string>();
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  async function refreshStatus() {
    setRefreshingStatus(true);
    try {
      await api.refreshLicenceStatus(id);
      await reload();
    } catch {
      /* keep last-known status */
    } finally {
      setRefreshingStatus(false);
    }
  }

  useEffect(() => {
    if (data) navigation.setOptions({ title: t(data.type) });
  }, [data, navigation, t]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  const cred = data!;
  const h = cred.holder;
  const favs = prefs.data?.favouriteCards ?? [];
  const isFavourite = favs.includes(cred.id);

  async function toggleFavourite() {
    if (!isFavourite && favs.length >= MAX_FAVOURITE_CARDS) return setNote(tr(`Up to ${MAX_FAVOURITE_CARDS} favourites. Remove one first.`, `Jusqu’à ${MAX_FAVOURITE_CARDS} favoris. Retirez-en un d’abord.`));
    await api.savePreferences({ favouriteCards: isFavourite ? favs.filter((x) => x !== cred.id) : [...favs, cred.id] });
    setNote(isFavourite ? tr('Removed from favourites.', 'Retiré des favoris.') : tr('Added to favourites.', 'Ajouté aux favoris.'));
    await prefs.reload();
  }

  async function copyAll() {
    const lines = [
      `${t(cred.type)} — ${cred.documentNumber}`,
      `${h.givenNames} ${h.surname}`,
      `${t('issued')}: ${cred.issuedOn} · ${t('expires')}: ${cred.expiresOn}`,
      ...(cred.licenceClass ? [`${t('class')}: ${cred.licenceClass}`] : []),
      ...(cred.vehicle ? [`${t('plate')}: ${cred.vehicle.plate} · ${t('vin')}: ${cred.vehicle.vin}`] : []),
      tr('Specimen — not a valid document', 'Spécimen — document non valide'),
    ].join('\n');
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(lines);
      else await Share.share({ message: lines });
      setNote(tr('All information copied.', 'Toute l’information a été copiée.'));
    } catch {
      setNote(tr('Copying isn’t available here.', 'La copie n’est pas offerte ici.'));
    }
  }

  return (
    <Screen>
      {cred.type === 'vehicle_permit' ? (
        <VehiclePermitDocument credential={cred} />
      ) : cred.type === 'driver_licence' ? (
        <FlipCard credential={cred} />
      ) : (
        <DocumentCard credential={cred} />
      )}
      {/* Live licence status, kept fresh automatically from the MTO record. */}
      {cred.type === 'driver_licence' && <LicenceStatusCard status={cred.licenceStatus} onRefresh={refreshStatus} refreshing={refreshingStatus} />}
      {cred.type !== 'driver_licence' && cred.status !== 'valid' && <Notice tone="danger">{t(cred.status)}</Notice>}

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

      <Widget title={tr('Document actions', 'Actions')}>
        <ListItem
          icon={isFavourite ? 'star' : 'star-outline'}
          title={isFavourite ? tr('Remove from favourites', 'Retirer des favoris') : tr('Add to favourites', 'Ajouter aux favoris')}
          subtitle={tr('Favourites show first on your home screen', 'Les favoris s’affichent en premier sur l’accueil')}
          onPress={() => void toggleFavourite()}
        />
        <Divider inset={52} />
        <ListItem icon="copy-outline" title={tr('Copy all information', 'Copier toute l’information')} onPress={() => void copyAll()} />
        <Divider inset={52} />
        <ListItem icon="create-outline" title={tr('Request a correction', 'Demander une correction')} subtitle={tr('Something on this document is wrong', 'Une information est erronée')} onPress={() => router.push(`/services/document-correction?credentialId=${cred.id}`)} />
      </Widget>
      {note && <Notice tone="success">{note}</Notice>}

      {DEMO_MODE && cred.type === 'driver_licence' && (
        <>
          <SectionHeader>{tr('Demo', 'Démo')}</SectionHeader>
          <Card style={{ gap: space.sm }}>
            <Txt v="strong">{tr('Simulate an MTO status change', 'Simuler un changement de statut du MTO')}</Txt>
            <Txt v="caption" muted>
              {tr('Pretend the driver record reported a new status. The app picks it up automatically and alerts you.', 'Faites comme si le dossier de conduite signalait un nouveau statut. L’application le détecte automatiquement et vous alerte.')}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {([
                ['Valid', tr('Valid', 'Valide')],
                ['NotValid', tr('Not valid', 'Non valide')],
                ['ValidWithIgnitionInterlock', tr('Interlock', 'Antidémarreur')],
                ['NotFound', tr('No record', 'Aucun dossier')],
              ] as const).map(([code, label]) => (
                <Button
                  key={code}
                  title={label}
                  size="md"
                  variant="secondary"
                  onPress={async () => {
                    await api.setDemoLicenceStatus(code);
                    await reload();
                  }}
                />
              ))}
            </View>
          </Card>
        </>
      )}

      <Widget title={tr('Related services', 'Services connexes')}>
        {RELATED[cred.type].map((sid, i) => {
          const s = serviceById(sid)!;
          return (
            <View key={sid}>
              {i > 0 && <Divider inset={52} />}
              <ListItem icon={CATEGORY_ICON[s.category]} title={pick(s.name)} onPress={() => router.push(serviceHref(s))} />
            </View>
          );
        })}
      </Widget>
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
