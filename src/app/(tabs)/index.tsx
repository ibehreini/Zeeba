import { StyleSheet, Switch, Text, View } from 'react-native';
import { useDataMode } from '@/context/DataModeContext';

export default function Index() {
  const { mode, toggleMode } = useDataMode();
  const isLive = mode === 'live';

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home screen</Text>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{isLive ? 'Using real Supabase data' : 'Using preview (dummy) data'}</Text>
        <Switch
          value={isLive}
          onValueChange={toggleMode}
          accessibilityLabel="Toggle between real and preview data"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#000',
  },
  toggleRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    color: '#333',
    fontSize: 15,
  },
});
