import ErrorText from '@/components/ErrorText';
import FormSubmitFooter from '@/components/FormSubmitFooter';
import LoadingIndicator from '@/components/LoadingIndicator';
import { useTheme } from '@/context/ThemeContext';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

type Props = ComponentProps<typeof FormSubmitFooter> & { children: ReactNode };

/**
 * The layout every add/edit form shares: the fields scroll, and the Save bar
 * (given the remaining props) stays pinned below the scroll view - see
 * FormSubmitFooter for why it must not move inside it.
 */
export default function FormScreen({ children, ...footer }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        keyboardShouldPersistTaps="handled"
        // iOS only (ignored elsewhere): scrolls the focused field above the
        // keyboard instead of letting the keyboard cover the lower fields.
        automaticallyAdjustKeyboardInsets
        // No web value on purpose: react-native-web would blur the focused
        // input on every scroll with "on-drag".
        keyboardDismissMode={Platform.select({ ios: 'interactive', android: 'on-drag' })}
      >
        {children}
      </ScrollView>

      <FormSubmitFooter {...footer} />
    </View>
  );
}

/** What an edit form shows while the record it edits is loading. */
export function FormLoadingView({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <LoadingIndicator label={label} />
    </View>
  );
}

/** What an edit form shows when the record it edits couldn't be loaded. */
export function FormErrorView({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: theme.background }]}>
      <ErrorText style={[styles.errorText, { color: theme.textSecondary }]}>{message}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
});
