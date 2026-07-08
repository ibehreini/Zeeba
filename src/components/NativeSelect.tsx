import { useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const [modalVisible, setModalVisible] = useState(false);
  const displayValue = value ? formatLabel(value) : placeholder;

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
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}${required ? ', required' : ''}`}
        accessibilityValue={{ text: value ? formatLabel(value) : 'Not selected' }}
        accessibilityHint="Double tap to change selection"
      >
        <Text style={[styles.fieldText, !value && styles.placeholderText]}>{displayValue}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {label}
            </Text>
            <ScrollView accessibilityRole="menu">
              {allowClear && (
                <Pressable
                  style={styles.option}
                  accessibilityRole="menuitem"
                  onPress={() => {
                    onChange(null);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.optionText}>Clear selection</Text>
                </Pressable>
              )}
              {options.map(option => (
                <Pressable
                  key={option}
                  style={styles.option}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: option === value }}
                  onPress={() => {
                    onChange(option);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.optionText}>{formatLabel(option)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={styles.cancelButton}
              accessibilityRole="button"
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  fieldPressed: {
    opacity: 0.7,
  },
  fieldText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  placeholderText: {
    color: '#999',
  },
  chevron: {
    fontSize: 20,
    color: '#999',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#1a1a1a',
    textTransform: 'capitalize',
  },
  cancelButton: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
