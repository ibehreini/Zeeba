import { useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useWebModalBackHandler } from '@/hooks/useWebModalBackHandler';
import { useTheme } from '@/context/ThemeContext';

function defaultFormatLabel(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  required?: boolean;
  /** Shows a "Clear" option so the field can be reset to null. Use for optional selects. */
  allowClear?: boolean;
  formatLabel?: (value: T) => string;
};

/**
 * A single-select field styled to match the app's plain form inputs. On iOS
 * it opens the real native action sheet (UIAlertController via
 * ActionSheetIOS), which VoiceOver reads and navigates automatically. On
 * other platforms it falls back to a simple accessible modal list.
 */
export default function NativeSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  required = false,
  allowClear = false,
  formatLabel = defaultFormatLabel,
}: Props<T>) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const displayValue = value ? formatLabel(value) : placeholder;

  useWebModalBackHandler(modalVisible, () => setModalVisible(false));

  const openPicker = () => {
    if (Platform.OS === 'ios') {
      const clearOption = allowClear && value ? ['Clear selection'] : [];
      const optionLabels = options.map(formatLabel);
      const buttons = [...optionLabels, ...clearOption, 'Cancel'];
      const cancelButtonIndex = buttons.length - 1;
      const clearButtonIndex = allowClear && value ? buttons.length - 2 : undefined;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: label,
          options: buttons,
          cancelButtonIndex,
          ...(clearButtonIndex !== undefined ? { destructiveButtonIndex: clearButtonIndex } : {}),
        },
        buttonIndex => {
          if (buttonIndex === cancelButtonIndex) return;
          if (clearButtonIndex !== undefined && buttonIndex === clearButtonIndex) {
            onChange(null);
            return;
          }
          onChange(options[buttonIndex]);
        },
      );
      return;
    }

    setModalVisible(true);
  };

  return (
    <View>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [styles.field, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }, pressed && styles.fieldPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}${required ? ', required' : ''}`}
        accessibilityValue={{ text: value ? formatLabel(value) : 'Not selected' }}
        accessibilityHint="Double tap to change selection"
      >
        <Text style={[styles.fieldText, { color: value ? theme.textPrimary : theme.textSecondary }]}>{displayValue}</Text>
        <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={() => setModalVisible(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: theme.textPrimary }]}>
              {label}
            </Text>
            <ScrollView accessibilityRole="menu">
              {allowClear && (
                <Pressable
                  style={[styles.option, { borderTopColor: theme.border }]}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    onChange(null);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: theme.textPrimary }]}>Clear selection</Text>
                </Pressable>
              )}
              {options.map(option => (
                <Pressable
                  key={option}
                  style={[styles.option, { borderTopColor: theme.border }]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: option === value }}
                  onPress={() => {
                    onChange(option);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, { color: theme.textPrimary }]}>{formatLabel(option)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={[styles.cancelButton, { backgroundColor: theme.surfaceAlt }]}
              accessibilityRole="button"
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textPrimary }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  fieldPressed: {
    opacity: 0.7,
  },
  fieldText: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 20,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontSize: 16,
    textTransform: 'capitalize',
  },
  cancelButton: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
