import ClosetRow from '@/components/ClosetRow';
import NativeSelect from '@/components/NativeSelect';
import type { ClothingCategory } from '@/constants/closetData';
import { useAuth } from '@/context/AuthContext';
import { useCloset } from '@/context/ClosetContext';
import { useDataMode } from '@/context/DataModeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  getErrorMessage,
  groupClosetItemsByAllCategories,
  OUTFIT_LABELS,
  type ClosetItem,
  type OutfitLabel,
} from '@/services/dataService.types';
import { markOutfitsDirty } from '@/state/outfitsRefresh';
import { showAlert } from '@/utils/alert';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Max picks per clothing category. Top/bottom/dress mirror how an outfit is
 * actually worn - one top + one bottom, OR one dress/romper, never both -
 * and shoes/jacket/bag follow the same "one worn at a time" rule. Accessories
 * are capped higher since outfits commonly stack a few (e.g. necklace +
 * earrings + bracelet) instead of wearing just one.
 */
const CATEGORY_SELECTION_LIMITS: Record<ClothingCategory, number> = {
  top: 1,
  bottom: 1,
  dress: 1,
  shoes: 1,
  jacket: 1,
  bag: 1,
  accessory: 3,
};

type SelectionByCategory = Record<ClothingCategory, string[]>;

const EMPTY_SELECTION: SelectionByCategory = {
  top: [],
  bottom: [],
  dress: [],
  shoes: [],
  jacket: [],
  bag: [],
  accessory: [],
};

export default function CreateOutfitForm() {
  const { theme } = useTheme();
  const router = useRouter();
  const { dataService } = useDataMode();
  const { activeClosetId } = useCloset();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState<OutfitLabel | null>(null);
  const [selectedByCategory, setSelectedByCategory] = useState<SelectionByCategory>(EMPTY_SELECTION);

  const [closetItems, setClosetItems] = useState<ClosetItem[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ClothingCategory | null>(null);

  // Loads the active closet's items once so the picker below has something to
  // render - the same data the Closet tab shows, grouped the same way.
  useEffect(() => {
    if (!activeClosetId) return;
    let cancelled = false;

    dataService
      .getClosetItems(activeClosetId)
      .then(items => {
        if (!cancelled) setClosetItems(items);
      })
      .catch(err => {
        if (!cancelled) setItemsError(getErrorMessage(err, 'Failed to load closet items.'));
      });

    return () => {
      cancelled = true;
    };
  }, [dataService, activeClosetId]);

  const closetSections = useMemo(
    () => (closetItems ? groupClosetItemsByAllCategories(closetItems) : []),
    [closetItems],
  );

  // Picks the initial tab once items load: the first category that actually
  // has items, or "Tops" if the closet is entirely empty. Every category tab
  // is always shown (even empty ones) so the picker's layout is stable.
  useEffect(() => {
    if (!closetItems || activeCategory) return;
    const firstWithItems = closetSections.find(section => section.data.length > 0);
    setActiveCategory((firstWithItems ?? closetSections[0])?.category ?? null);
  }, [closetItems, closetSections, activeCategory]);

  const activeSection = closetSections.find(section => section.category === activeCategory) ?? null;

  const selectedItemIds = Object.values(selectedByCategory).flat();

  /**
   * Tapping an item toggles it on/off. Single-select categories (top,
   * bottom, dress, shoes, jacket, bag) swap in the new pick instead of
   * requiring the old one to be manually deselected first. Picking a dress
   * clears any picked top/bottom (and vice versa), since an outfit is one or
   * the other, not both. Accessories can stack up to their limit; tapping
   * past it just shows a message instead of silently dropping an old pick.
   */
  const handleToggleItem = (item: ClosetItem) => {
    const { category } = item;
    const limit = CATEGORY_SELECTION_LIMITS[category];
    const current = selectedByCategory[category];

    if (current.includes(item.item_id)) {
      setSelectedByCategory(prev => ({
        ...prev,
        [category]: prev[category].filter(id => id !== item.item_id),
      }));
      return;
    }

    if (current.length >= limit) {
      if (limit === 1) {
        setSelectedByCategory(prev => ({ ...prev, [category]: [item.item_id] }));
      } else {
        showAlert('Limit reached', `You can pick up to ${limit} accessories per outfit.`);
      }
      return;
    }

    setSelectedByCategory(prev => {
      const next: SelectionByCategory = { ...prev, [category]: [...prev[category], item.item_id] };
      if (category === 'dress') {
        next.top = [];
        next.bottom = [];
      } else if (category === 'top' || category === 'bottom') {
        next.dress = [];
      }
      return next;
    });
  };

  const canSubmit =
    !submitting && name.trim().length > 0 && description.trim().length > 0 && !!label && selectedItemIds.length > 0;

  const handleSubmit = async () => {
    if (!activeClosetId) {
      showAlert('No closet found', 'You need a closet before you can create an outfit.');
      return;
    }
    if (!name.trim() || !description.trim() || !label || selectedItemIds.length === 0) {
      showAlert(
        'Missing information',
        'Name, description, a label, and at least one clothing item are all required.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await dataService.createOutfit({
        closetId: activeClosetId,
        userId,
        name: name.trim(),
        description: description.trim(),
        label,
        itemIds: selectedItemIds,
      });

      markOutfitsDirty();
      showAlert('Outfit created', `"${created.name}" was added to your closet.`, [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            router.push({
              pathname: '/outfit/[id]',
              params: { id: created.outfit_id },
            });
          },
        },
      ]);
    } catch (err) {
      showAlert('Couldn’t create outfit', getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      keyboardShouldPersistTaps="handled"
    >
      <LabeledTextInput
        label="Name"
        required
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sunday Brunch"
        maxLength={100}
      />

      <LabeledTextInput
        label="Description"
        required
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the outfit"
        maxLength={1000}
      />

      <Field label="Label" required>
        <NativeSelect
          label="Label"
          options={OUTFIT_LABELS}
          value={label}
          onChange={setLabel}
          placeholder="Select a label"
          required
        />
      </Field>

      <Field label="Items" required>
        {itemsError ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>{itemsError}</Text>
        ) : !closetItems ? (
          <ActivityIndicator style={styles.itemsLoading} />
        ) : closetItems.length === 0 ? (
          <Text style={[styles.errorText, { color: theme.danger }]}>No items in this closet yet.</Text>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabRow}
              role="tablist"
            >
              {closetSections.map(section => {
                const isActive = section.category === activeCategory;
                return (
                  <Pressable
                    key={section.category}
                    onPress={() => setActiveCategory(section.category)}
                    role="tab"
                    aria-label={section.title}
                    aria-selected={isActive}
                    style={({ pressed }) => [
                      styles.tab,
                      { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                      isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
                      pressed && styles.tabPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: theme.textPrimary },
                        isActive && { color: theme.onAccent },
                      ]}
                    >{section.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {activeSection && activeSection.data.length === 0 ? (
              <Text style={[styles.emptyTabText, { color: theme.textSecondary }]}>No {activeSection.title.toLowerCase()} in this closet yet.</Text>
            ) : (
              activeSection && (
                <ClosetRow
                  items={activeSection.data}
                  onItemPress={id => {
                    const item = activeSection.data.find(candidate => candidate.item_id === id);
                    if (item) handleToggleItem(item);
                  }}
                  isItemSelected={id => selectedItemIds.includes(id)}
                />
              )
            )}
          </>
        )}
      </Field>

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: theme.accent },
          !canSubmit && { backgroundColor: theme.textSecondary },
          pressed && styles.submitButtonPressed,
        ]}
        role="button"
        aria-label="Save outfit"
        aria-disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.onAccent }]}>Save Outfit</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

function Field({ label, required, children }: FieldProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>
        {label}
        {required && <Text style={{ color: theme.danger }}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

type LabeledTextInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
};

function LabeledTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  maxLength,
}: LabeledTextInputProps) {
  const { theme } = useTheme();
  const themedInput = {
    backgroundColor: theme.surfaceAlt,
    borderColor: theme.border,
    color: theme.textPrimary,
  };
  return (
    <Field label={label} required={required}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        maxLength={maxLength}
        style={multiline ? [styles.textInput, themedInput, styles.multilineInput] : [styles.textInput, themedInput]}
        aria-label={required ? `${label}, required` : label}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  itemsLoading: {
    marginTop: 12,
  },
  tabRow: {
    gap: 8,
    paddingBottom: 12,
  },
  tab: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPressed: {
    opacity: 0.8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 15,
  },
  emptyTabText: {
    fontSize: 15,
    paddingHorizontal: 10,
  },
  submitButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
