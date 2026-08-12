import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Makes the Android Chrome back gesture close an open <Modal> instead of
 * leaving the screen. React Native's Modal doesn't touch browser history on
 * web, so without this the gesture skips the modal entirely and navigates
 * the underlying route back. Pushes a throwaway history entry while the
 * modal is open and consumes it again when the modal closes (by either
 * path). No-ops on native, where there's no browser history to interact with.
 */
export function useWebModalBackHandler(visible: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    window.history.pushState({ modal: true }, '');
    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.modal) window.history.back();
    };
  }, [visible]);
}
