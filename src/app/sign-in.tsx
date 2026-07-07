import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
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
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={5}
              style={styles.button}
              onPress={() => handleSignIn(signInWithApple)}
            />
          )}
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
});
