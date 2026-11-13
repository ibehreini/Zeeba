import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { showAlert } from '@/utils/alert';
import { pickLibraryImages } from '@/utils/pickLibraryImages';

type PhotoSource = 'camera' | 'library';

/**
 * Gets one photo from the user, letting them choose between taking it with
 * the camera and picking it from their library. Resolves with the photo's
 * local uri, or null if they cancelled, denied access, or the photo couldn't
 * be read (each of those has already been explained to them).
 *
 * On web there is no question to ask: the browser's own file picker already
 * offers the camera on phones, so this goes straight to it.
 */
export async function pickPhoto(): Promise<string | null> {
  const source = await choosePhotoSource();
  if (!source) return null;

  if (source === 'library') {
    const [uri] = await pickLibraryImages(false);
    return uri ?? null;
  }
  return takePhoto();
}

/**
 * Asks "Take photo" or "Choose from library" with the platform's own sheet,
 * which VoiceOver and TalkBack read and navigate without any extra work.
 * Resolves null when dismissed.
 */
function choosePhotoSource(): Promise<PhotoSource | null> {
  if (Platform.OS === 'web') return Promise.resolve('library');

  if (Platform.OS === 'ios') {
    return new Promise(resolve => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        buttonIndex => resolve(buttonIndex === 0 ? 'camera' : buttonIndex === 1 ? 'library' : null),
      );
    });
  }

  return new Promise(resolve => {
    Alert.alert(
      'Add photo',
      undefined,
      [
        { text: 'Take photo', onPress: () => resolve('camera') },
        { text: 'Choose from library', onPress: () => resolve('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/** Requests camera access if needed, then opens the camera. Returns the photo's uri, or null. */
async function takePhoto(): Promise<string | null> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    granted = requested.status === 'granted';
  }
  if (!granted) {
    showAlert('Camera access needed', 'Please allow camera access in Settings to take photos.');
    return null;
  }

  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  } catch {
    // Callers await this outside their upload try/catch, so a rejection here
    // would be an unhandled promise rejection with no feedback. Reachable on
    // the iOS simulator and on devices without a camera.
    showAlert("Couldn't open the camera", 'The camera isn’t available on this device. Choose a photo from your library instead.');
    return null;
  }
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}
