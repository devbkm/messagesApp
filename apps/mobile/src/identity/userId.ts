import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const STORAGE_KEY = 'inbox.userId';

let cached: Promise<string> | null = null;

/**
 * The id this device uses to identify its user to the API (sent as `X-User-Id`).
 *
 * Generated once and persisted, so the same inbox is shown across app restarts.
 * This matches the backend's deliberately simplified identification; with real
 * authentication this module would return the signed-in user's token instead.
 */
export function getUserId(): Promise<string> {
  cached ??= loadOrCreate().catch((error: unknown) => {
    cached = null; // allow a later retry
    throw error;
  });
  return cached;
}

async function loadOrCreate(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const id = randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}
