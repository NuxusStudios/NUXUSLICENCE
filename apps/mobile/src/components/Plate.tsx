import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/theme';

/** A licence plate, drawn like the real thing: white plate, dark border, mono letters. */
export function Plate({ plate, jurisdiction, size = 'md' }: { plate: string; jurisdiction?: string; size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <View style={[styles.plate, lg && { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10 }]} accessibilityLabel={`Plate ${plate}`}>
      {jurisdiction ? <Text style={[styles.juris, lg && { fontSize: 10 }]}>{jurisdiction}</Text> : null}
      <Text style={[styles.text, lg && { fontSize: 28, letterSpacing: 3 }]}>{plate}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderWidth: 2,
    borderColor: '#16325C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  juris: { color: '#16325C', fontFamily: fonts.bold, fontSize: 8, letterSpacing: 2 },
  text: { color: '#16325C', fontFamily: fonts.monoBold, fontSize: 18, letterSpacing: 2 },
});
