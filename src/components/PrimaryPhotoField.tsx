import { Field } from '@/components/FormField';
import RemoveBackgroundButton from '@/components/RemoveBackgroundButton';
import { useTheme } from '@/context/ThemeContext';
import { pickPhoto } from '@/utils/pickPhoto';
import { revokeIfBlobUrl } from '@/utils/revokeIfBlobUrl';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, type ImageSourcePropType } from 'react-native';

/**
 * The add and edit item forms' primary-photo state: a newly picked photo, and
 * the background-removed cutout of whatever photo is shown, when the user
 * asked for one. The original is kept so "Restore original photo" can undo it.
 */
export function usePrimaryPhoto() {
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [cutoutUri, setCutoutUri] = useState<string | null>(null);
  // On web the cutout is a blob: URL pinning the whole PNG in memory. It's
  // revoked when replaced or restored; this frees whatever is left when the
  // form closes (after a save, the upload has already read it).
  const cutoutUriRef = useRef(cutoutUri);
  cutoutUriRef.current = cutoutUri;
  useEffect(() => () => revokeIfBlobUrl(cutoutUriRef.current), []);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);

  const clearCutout = () => {
    revokeIfBlobUrl(cutoutUri);
    setCutoutUri(null);
  };

  const pick = async () => {
    const uri = await pickPhoto();
    if (!uri) return;
    // On web each pick mints a fresh object URL; free the one it replaces.
    if (uri !== pickedUri) revokeIfBlobUrl(pickedUri);
    setPickedUri(uri);
    // A cutout belongs to the photo it was made from.
    clearCutout();
  };

  return { pickedUri, cutoutUri, setCutoutUri, clearCutout, pick, isRemovingBackground, setIsRemovingBackground };
}

type Props = {
  photo: ReturnType<typeof usePrimaryPhoto>;
  /** What the photo box shows; null shows the "+ Add photo" placeholder. */
  source: ImageSourcePropType | null;
  /** The shown photo is a cutout. */
  showingCutout: boolean;
  /** The photo "Remove background" would work on, or null to hide that button. */
  removableUri: string | null;
  required?: boolean;
  disabled: boolean;
};

/** The tappable photo box plus the Remove background toggle under it. */
export default function PrimaryPhotoField({ photo, source, showingCutout, removableUri, required, disabled }: Props) {
  const { theme } = useTheme();
  return (
    <Field label="Primary photo" required={required}>
      <Pressable
        onPress={photo.pick}
        style={[styles.primaryPhotoBox, { borderColor: theme.border }]}
        role="button"
        aria-label={
          !source
            ? 'Add primary photo, required'
            : showingCutout
              ? 'Change primary photo. Background removed.'
              : 'Change primary photo'
        }
      >
        {source ? (
          <Image
            source={source}
            style={styles.primaryPhotoImage}
            // A cutout is trimmed tight to the garment, so "cover" would crop it.
            resizeMode={showingCutout ? 'contain' : 'cover'}
          />
        ) : (
          <Text style={styles.primaryPhotoPlaceholder}>+ Add photo</Text>
        )}
      </Pressable>
      <RemoveBackgroundButton
        sourceUri={removableUri}
        isRemoved={!!photo.cutoutUri}
        onRemoved={photo.setCutoutUri}
        onRestore={photo.clearCutout}
        onBusyChange={photo.setIsRemovingBackground}
        disabled={disabled}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  primaryPhotoBox: {
    width: 160,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    // Photo wells stay light in both themes: the garment photos are shot on white, so a dark well would frame each one in a hard white box.
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryPhotoImage: {
    width: '100%',
    height: '100%',
  },
  primaryPhotoPlaceholder: {
    fontSize: 15,
    fontWeight: '600',
    // Sits on the hardcoded-light photo well, so it stays a fixed grey in both themes.
    color: '#666666', // 5.5:1 on #fafafa (#999 was 2.7:1)
  },
});
