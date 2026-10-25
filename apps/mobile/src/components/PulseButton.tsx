import { useEffect, useState } from 'react';
import { Animated, Easing, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Button, type IconName } from './ui';
import { radius } from '../lib/theme';

// A React Native adaptation of the "pulse beams" effect: a bright gradient beam
// of light that travels around the CTA's rounded border, over the tinted-glass
// pill. (The original Tailwind/framer-motion web component can't run in Expo, so
// this recreates the pulse with react-native-svg + a looping dash animation.)

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const START = '#18CCFC';
const MIDDLE = '#6344F5';
const END = '#AE48FF';

export function PulseButton({ title, icon, onPress }: { title: string; icon?: IconName; onPress: () => void }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (width !== size.w || height !== size.h)) setSize({ w: width, h: height });
  };

  const r = radius.md;
  const perim = size.w && size.h ? 2 * (size.w - 2 + (size.h - 2)) - (8 - 2 * Math.PI) * r : 0;
  const seg = perim * 0.3; // length of the travelling light
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [perim, 0] });

  return (
    <View style={{ position: 'relative' }} onLayout={onLayout}>
      <Button title={title} icon={icon} onPress={onPress} />
      {perim > 0 ? (
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width={size.w} height={size.h} pointerEvents="none">
          <Defs>
            <LinearGradient id="pulse" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={START} stopOpacity="0" />
              <Stop offset="35%" stopColor={START} stopOpacity="1" />
              <Stop offset="65%" stopColor={MIDDLE} stopOpacity="1" />
              <Stop offset="100%" stopColor={END} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <AnimatedRect
            x={1}
            y={1}
            width={size.w - 2}
            height={size.h - 2}
            rx={r}
            ry={r}
            fill="none"
            stroke="url(#pulse)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${seg}, ${perim}`}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      ) : null}
    </View>
  );
}
