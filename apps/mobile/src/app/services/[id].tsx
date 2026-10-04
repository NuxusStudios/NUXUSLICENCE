import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Body, Button, Card, ErrorState, Field, Loading, Notice, Row, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { radius, space, useTheme } from '../../lib/theme';
import type { ServiceRequest } from '../../lib/types';
import { useAsync } from '../../lib/useAsync';

export default function ServiceForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const { t, pick, lang } = useI18n();
  const navigation = useNavigation();
  const { data, error, loading, reload } = useAsync(api.services);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [done, setDone] = useState<ServiceRequest>();

  const service = data?.find((s) => s.id === id);
  useEffect(() => {
    if (service) navigation.setOptions({ title: pick(service.name) });
  }, [service, navigation, pick]);

  if (!data && loading) return <Loading />;
  if (!data && error) return <ErrorState error={error} onRetry={reload} />;
  if (!service) return <ErrorState error={new Error('Service not found')} onRetry={() => router.back()} />;

  const complete = service.fields.every((f) => !f.required || values[f.key]?.trim());

  async function submit() {
    if (!service) return;
    if (service.fee > 0) {
      router.push({ pathname: '/pay', params: { kind: 'service', id: service.id, amount: String(service.fee), label: pick(service.name), data: JSON.stringify(values) } });
      return;
    }
    setBusy(true);
    setSubmitError(undefined);
    try {
      setDone(await api.submitService(service.id, { data: values }));
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Notice tone="success">
          {t('requestSubmitted')} · {t('reference')} {done.reference}
        </Notice>
        <Button title={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body muted>{pick(service.description)}</Body>
      <Card>
        <Row label={t('fee')} value={service.fee ? money(service.fee, lang) : t('free')} strong />
      </Card>
      {service.fields.map((f) =>
        f.type === 'select' ? (
          <View key={f.key} style={{ gap: space.xs }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{pick(f.label)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {f.options!.map((o) => {
                const on = values[f.key] === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => setValues((v) => ({ ...v, [f.key]: o }))}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.surfaceAlt : c.surface }}
                  >
                    <Text style={{ color: on ? c.primary : c.text, fontWeight: '600' }}>{o}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <Field
            key={f.key}
            label={pick(f.label)}
            value={values[f.key] ?? ''}
            onChangeText={(text) => setValues((v) => ({ ...v, [f.key]: text }))}
            placeholder={f.type === 'date' ? 'YYYY-MM-DD' : undefined}
          />
        ),
      )}
      {submitError && <Notice tone="danger">{submitError}</Notice>}
      <Button title={service.fee ? `${t('continue')} · ${money(service.fee, lang)}` : t('submit')} onPress={submit} loading={busy} disabled={!complete} />
    </Screen>
  );
}
