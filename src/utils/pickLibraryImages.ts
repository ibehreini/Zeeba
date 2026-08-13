import * as ImagePicker from 'expo-image-picker';
import { showAlert } from '@/utils/alert';

/** Requests photo library access if needed, then opens the native photo picker. Returns picked image URIs, or [] if cancelled/denied/unreadable. */
export async function pickLibraryImages(allowsMultipleSelection: boolean): Promise<string[]> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    granted = requested.status === 'granted';
  }
  if (!granted) {
    showAlert('Photo access needed', 'Please allow photo library access in Settings to add photos.');
    return [];
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection,
      quality: 0.8,
    });
  } catch (err) {
    // Every caller awaits this outside its upload try/catch, so a rejection
    // here would otherwise be an unhandled promise rejection with no
    // feedback. Reachable on web: the picker rejects when the chosen file
    // isn't a readable image (the file dialog's image/* filter is only
    // advisory - "All Files" lets anything through).
    showAlert("Couldn't read that file", 'Please choose an image file, such as a JPEG or PNG.');
    return [];
  }
  if (result.canceled) return [];
  return result.assets.map(asset => asset.uri);
}
