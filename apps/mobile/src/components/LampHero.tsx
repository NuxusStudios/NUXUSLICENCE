import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';

// A React Native port of the "lamp" hero: a dark band with a radial glow at the
// top, a bright beam that grows on mount, and content that rises into place.
// (The original Tailwind/framer-motion web component can't run in Expo/RN, so
// this recreates the look with react-native-svg + the Animated API.)

const HERO_BG = '#06080C';
const GLOW = '#5B8DEF';

export function LampHero({ children, header, style }: { children: ReactNode; header?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 680);
  const beam = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(beam, { toValue: 1, duration: 850, delay: 150, useNativeDriver: false }),
      Animated.timing(rise, { toValue: 1, duration: 700, delay: 250, useNativeDriver: true }),
    ]).start();
  }, [beam, rise]);

  const lineWidth = beam.interpolate({ inputRange: [0, 1], outputRange: [w * 0.22, w * 0.68] });
  const lineOpacity = beam.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [44, 0] });

  return (
    <View style={[styles.wrap, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="lampGlow" cx="50%" cy="6%" rx="60%" ry="46%">
            <Stop offset="0" stopColor={GLOW} stopOpacity="0.60" />
            <Stop offset="0.4" stopColor={GLOW} stopOpacity="0.16" />
            <Stop offset="1" stopColor={GLOW} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lampGlow)" />
      </Svg>

      {header ? (
        <View style={styles.header} pointerEvents="box-none">
          {header}
        </View>
      ) : null}

      {/* The bright beam line that grows on mount. */}
      <Animated.View style={[styles.beam, { width: lineWidth, opacity: lineOpacity }]} />

      <Animated.View style={{ opacity: rise, transform: [{ translateY }], width: '100%', alignItems: 'center' }}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: HERO_BG,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 92,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  beam: {
    height: 2,
    borderRadius: 2,
    backgroundColor: GLOW,
    marginBottom: 28,
    boxShadow: `0px 0px 18px 2px ${GLOW}`,
  },
  header: { position: 'absolute', top: 18, left: 22, right: 22, zIndex: 10 },
});
