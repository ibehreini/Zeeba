import fs from 'fs';
import path from 'path';
import type { ExpoConfig } from 'expo/config';

// Some Expo CLI commands (e.g. `expo export`) evaluate this file before their
// own .env preloading populates process.env, so EXPO_PUBLIC_* vars can't be
// trusted to be set here. Read .env.local directly instead.
function readEnvLocal(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === key) return trimmed.slice(eq + 1).trim();
  }
  return undefined;
}

// The native Google Sign-In library needs the iOS OAuth client's ID reversed
// into a URL scheme (e.g. `1234-abc.apps.googleusercontent.com` ->
// `com.googleusercontent.apps.1234-abc`). Deriving it here keeps the iOS
// client ID's single source of truth in .env.local instead of duplicating it.
// .env.local is gitignored, so CI/hosting builds (EAS, Cloudflare) fall back to
// this literal - the plugin hard-errors on a missing scheme, and the value is
// not a secret since it ships inside the app binary anyway.
const FALLBACK_IOS_URL_SCHEME =
  'com.googleusercontent.apps.1087732820060-6o5j02ahldh3i6nsi38l1marbraihcqb';
const iosClientId = readEnvLocal('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : FALLBACK_IOS_URL_SCHEME;

const config: ExpoConfig = {
  name: 'zeeba',
  slug: 'zeeba',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'zeeba',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.idabeeme.zeeba',
    usesAppleSignIn: true,
    // Universal links have two halves and both must name the same host: the
    // site serves public/.well-known/apple-app-site-association (as JSON - see
    // public/_headers), and the app claims that host here. Without this entry
    // iOS never fetches the association file, so every zeeba link opens Safari
    // instead of the app. `webcredentials` matches the same block in the AASA
    // file and is what lets iOS offer saved passwords for the domain.
    // Update both this list and the AASA appIDs when the custom domain lands -
    // an extra applinks entry is harmless, so the pages.dev host can stay.
    associatedDomains: [
      'applinks:zeeba-5kv.pages.dev',
      'webcredentials:zeeba-5kv.pages.dev',
    ],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme },
    ],
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow Zeeba to access your photos so you can add pictures of your clothing items.',
      },
    ],
    'react-native-compressor',
    [
      'expo-build-properties',
      {
        // GoogleSignIn's pod chain (AppCheckCore -> GoogleUtilities/RecaptchaInterop)
        // ships Swift pods without module maps, which CocoaPods refuses to link
        // as static libraries. This is EAS build error `pod install exited with
        // non-zero code: 1` / "Swift pods cannot yet be integrated as static
        // libraries" - enabling modular headers for just these pods fixes it.
        ios: {
          extraPods: [
            { name: 'GoogleUtilities', modular_headers: true },
            { name: 'RecaptchaInterop', modular_headers: true },
            { name: 'AppCheckCore', modular_headers: true },
          ],
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '698c6750-88bc-4970-b67b-81fb077a04dc',
    },
  },
  owner: 'idabeeme',
};

export default config;
