import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that actually works on web.
 *
 * react-native-web ships Alert as an empty stub (`static alert() {}`), so on
 * web every confirm dialog, error message, and success callback routed through
 * Alert.alert silently did nothing - delete buttons were dead, failed saves
 * showed no feedback, and post-create navigation (inside an OK onPress) never
 * ran. On web this maps to window.confirm/window.alert; native is unchanged.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  // Zero or one button: plain notice. The single button's onPress (used for
  // post-success navigation) still runs after dismissal.
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Two or more buttons: confirm maps OK to the first non-cancel button and
  // Cancel to the cancel-styled one, matching how the app builds its dialogs.
  const confirmed = window.confirm(text);
  const target = confirmed
    ? buttons.find(button => button.style !== 'cancel')
    : buttons.find(button => button.style === 'cancel');
  target?.onPress?.();
}
