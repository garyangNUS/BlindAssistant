import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function TabTwoScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText
            type="title"
            style={{
              fontFamily: Fonts.rounded,
            }}>
            Explore
          </ThemedText>
        </ThemedView>
        <ThemedText style={styles.text}>
          This is the Explore tab.
        </ThemedText>
        <ThemedText style={styles.text}>
          Focus on the medication reader in the Home tab for your project.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    marginTop: 40,
  },
  text: {
    color: '#a0a0a0',
    marginBottom: 10,
  },
});