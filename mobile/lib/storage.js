import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const hasLocal = () => typeof localStorage !== 'undefined';

// SecureStore values are only reliable up to ~2KB. Supabase sessions (JWT +
// refresh token + user object) are often larger, so split them into chunks
// that each stay inside the Keychain/Keystore, instead of falling back to
// unencrypted storage.
const CHUNK_SIZE = 1800;
const countKey = (key) => `${key}.chunks`;
const chunkKey = (key, i) => `${key}.chunk${i}`;

async function removeChunks(key) {
  const n = Number((await SecureStore.getItemAsync(countKey(key))) || 0);
  await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
  await SecureStore.deleteItemAsync(countKey(key));
}

const secure = {
  async getItem(key) {
    const n = Number((await SecureStore.getItemAsync(countKey(key))) || 0);
    if (!n) return SecureStore.getItemAsync(key);
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key, value) {
    await removeChunks(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    await SecureStore.deleteItemAsync(key);
    const n = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < n; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(countKey(key), String(n));
  },
  async removeItem(key) {
    await removeChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

// Small key/value store: SecureStore on device, localStorage on web.
export const storage = {
  getItem: (key) =>
    Platform.OS === 'web' ? Promise.resolve(hasLocal() ? localStorage.getItem(key) : null) : secure.getItem(key),
  setItem: (key, value) =>
    Platform.OS === 'web'
      ? Promise.resolve(hasLocal() ? localStorage.setItem(key, value) : undefined)
      : secure.setItem(key, value),
  removeItem: (key) =>
    Platform.OS === 'web'
      ? Promise.resolve(hasLocal() ? localStorage.removeItem(key) : undefined)
      : secure.removeItem(key),
};
