import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/** Requests photo library access if needed, then opens the native photo picker. Returns picked image URIs, or [] if cancelled/denied. */
export async function pickLibraryImages(allowsMultipleSelection: boolean): Promise<string[]> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    granted = requested.status === 'granted';
  }
  if (!granted) {
    Alert.alert('Photo access needed', 'Please allow photo library access in Settings to add photos.');
    return [];
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map(asset => asset.uri);
}
