import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'inbox.sessionToken';

/**
 * The session token, kept in the platform's secure storage (iOS Keychain / Android
 * Keystore-backed storage). Secure storage is unavailable in the Expo *web* preview,
 * which falls back to AsyncStorage; that target is for development only.
 *
 * The token alone never decides whether the user is signed in: the app confirms it
 * with the server (GET /auth/me) on start-up.
 */
let cached: string | null | undefined;

const useSecureStore = Platform.OS !== 'web';

export async function getToken(): Promise<string | null> {
  if (cached === undefined) {
    cached = (useSecureStore ? await SecureStore.getItemAsync(KEY) : await AsyncStorage.getItem(KEY)) ?? null;
  }
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  if (useSecureStore) await SecureStore.setItemAsync(KEY, token);
  else await AsyncStorage.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  if (useSecureStore) await SecureStore.deleteItemAsync(KEY);
  else await AsyncStorage.removeItem(KEY);
}

/** Tests only: forget the in-memory copy, as after an app restart. */
export function resetTokenCacheForTests(): void {
  cached = undefined;
}
