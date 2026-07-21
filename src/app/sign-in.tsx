import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function SignInScreen() {
  const { signInWithGoogle, continueAsGuest } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async (signIn: () => Promise<void>) => {
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      Alert.alert('Sign-in failed', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  // @react-native-google-signin's web implementation is a paid sponsor-only
  // feature, so it can't sign in from a browser. This app's web build is
  // just expo-router's static export of the mobile app, not a target for
  // auth, so point users at the native app instead of showing a dead button.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.webMessage}>Sign in from the iOS or Android app.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isSigningIn ? (
        <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
      ) : (
        <>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            style={styles.button}
            onPress={() => handleSignIn(signInWithGoogle)}
          />
          <View style={styles.previewRow}>
            <Text style={styles.previewText}>Want to test it out first?</Text>
            <Pressable
              onPress={continueAsGuest}
              style={styles.previewButton}
              accessibilityRole="button"
              accessibilityLabel="Preview mode"
              accessibilityHint="Skips sign-in and shows sample data. Closing the app ends the preview and you'll need to sign in again."
            >
              <Text style={styles.previewButtonText}>Preview mode</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    width: 240,
    height: 48,
  },
  spinner: {
    height: 48,
  },
  webMessage: {
    color: '#fff',
    fontSize: 16,
  },
  previewRow: {
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    color: '#ccc',
    fontSize: 14,
  },
  previewButton: {
    width: 240,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
