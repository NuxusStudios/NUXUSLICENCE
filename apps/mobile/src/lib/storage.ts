import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tokens live in the iOS Keychain / Android Keystore via SecureStore. The web
// build (used for previews and QA only) falls back to sessionStorage.
const web = {
  get(key: string) {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {
      // storage unavailable (private mode) — session simply won't persist
    }
  },
  del(key: string) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return web.get(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return web.set(key, value);
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return web.del(key);
    await SecureStore.deleteItemAsync(key);
  },
};
