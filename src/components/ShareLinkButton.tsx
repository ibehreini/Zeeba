import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

// Native builds can't read window.location, so they need the site's origin
// hardcoded. Update alongside ios.associatedDomains and the AASA/assetlinks
// files when the custom domain lands.
const WEB_ORIGIN = 'https://zeeba-5kv.pages.dev';

type Props = {
  /** App path to share, e.g. `/outfit/${id}` - must match an Expo Router route. */
  path: string;
  title?: string;
};

export default function ShareLinkButton({ path, title }: Props) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handlePress = async () => {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin + path
        : WEB_ORIGIN + path;

    if (Platform.OS === 'web') {
      // Mobile browsers get the native share sheet; desktop browsers mostly
      // don't implement navigator.share, so fall back to copying the link.
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title, url });
        } catch {
          // User dismissed the share sheet.
        }
      } else {
        await Clipboard.setStringAsync(url);
        setCopied(true);
      }
      return;
    }

    try {
      // iOS reads `url` (and renders a link preview); Android only reads `message`.
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Link copied' : 'Share link'}
      hitSlop={10}
    >
      <Ionicons
        name={copied ? 'checkmark' : 'share-outline'}
        size={24}
        color={copied ? theme.accent : theme.textPrimary}
      />
    </Pressable>
  );
}
