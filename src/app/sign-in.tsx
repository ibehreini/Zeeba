import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TEST_ACCOUNTS } from '@/constants/testAccounts';
import { isTestAuthEnabled, useAuth } from '@/context/AuthContext';
import { showAlert } from '@/utils/alert';

export default function SignInScreen() {
  const { signInWithGoogle, signInWithTestAccount, continueAsGuest } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async (signIn: () => Promise<void>) => {
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error) {
      showAlert('Sign-in failed', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  // Pointed at local Supabase docker (EXPO_PUBLIC_ENABLE_TEST_AUTH=true): neither
  // Google nor Apple's OAuth redirect can complete against a non-public local URL,
  // so swap in a list of seeded test accounts (supabase/seed.sql) instead of the
  // real providers - tap one to sign in as that user.
  if (isTestAuthEnabled) {
    return (
      <View style={styles.container}>
        {isSigningIn ? (
          <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
        ) : (
          <ScrollView contentContainerStyle={styles.testAccountList}>
            <Text style={styles.testAccountHeading}>Sign in as a test account</Text>
            {TEST_ACCOUNTS.map(account => (
              <Pressable
                key={account.email}
                onPress={() => handleSignIn(() => signInWithTestAccount(account.email))}
                style={styles.testAccountRow}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${account.name}`}
              >
                <Text style={styles.testAccountName}>{account.name}</Text>
                <Text style={styles.testAccountDescription}>{account.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // @react-native-google-signin's web implementation is a paid sponsor-only
  // feature, so web bypasses that package entirely and uses Supabase's
  // browser redirect flow (signInWithOAuth) instead.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {isSigningIn ? (
          <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
        ) : (
          <Pressable
            onPress={() => handleSignIn(signInWithGoogle)}
            style={styles.webGoogleButton}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
          >
            <Text style={styles.webGoogleButtonText}>Sign in with Google</Text>
          </Pressable>
        )}
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
  webGoogleButton: {
    width: 240,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  testAccountList: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 24,
    gap: 10,
  },
  testAccountHeading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  testAccountRow: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d434a',
    backgroundColor: '#2f353c',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  testAccountName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testAccountDescription: {
    color: '#aab0b6',
    fontSize: 13,
    marginTop: 2,
  },
  webGoogleButtonText: {
    color: '#25292e',
    fontSize: 16,
    fontWeight: '600',
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
