import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useI18n } from '../lib/i18n';
import { space } from '../lib/theme';
import type { Credential } from '../lib/types';
import { DocumentCard, DocumentCardBack } from './DocumentCard';
import { Segmented, Txt } from './ui';

const NATIVE = Platform.OS !== 'web';

/**
 * Front and back of a card. Tap the card (or use the switch) to turn it over;
 * the turn is a quick horizontal squash, or an instant swap with Reduce Motion.
 */
export function FlipCard({ credential }: { credential: Credential }) {
  const { t } = useI18n();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [squash] = useState(() => new Animated.Value(1));
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
  }, []);

  function turnTo(next: 'front' | 'back') {
    if (next === side) return;
    if (reduce) return setSide(next);
    Animated.timing(squash, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(() => {
      setSide(next);
      Animated.timing(squash, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
    });
  }

  return (
    <View style={{ gap: space.md }}>
      <Pressable
        onPress={() => turnTo(side === 'front' ? 'back' : 'front')}
        accessibilityRole="button"
        accessibilityLabel={t('flipCard')}
        accessibilityHint={t('flipHint')}
      >
        <Animated.View style={{ transform: [{ scaleX: squash }] }}>
          {side === 'front' ? <DocumentCard credential={credential} /> : <DocumentCardBack credential={credential} />}
        </Animated.View>
      </Pressable>
      <Segmented
        value={side}
        onChange={turnTo}
        options={[
          { value: 'front', label: t('cardFront') },
          { value: 'back', label: t('cardBack') },
        ]}
      />
      <Txt v="caption" faint style={{ textAlign: 'center', marginTop: -space.xs }}>
        {t('flipHint')}
      </Txt>
    </View>
  );
}
