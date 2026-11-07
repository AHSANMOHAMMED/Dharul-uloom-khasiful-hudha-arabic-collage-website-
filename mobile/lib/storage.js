import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const hasLocal = () => typeof localStorage !== 'undefined';

// Small key/value store: SecureStore on device, localStorage on web.
export const storage = {
  getItem: (key) =>
    Platform.OS === 'web'
      ? Promise.resolve(hasLocal() ? localStorage.getItem(key) : null)
      : SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    Platform.OS === 'web'
      ? Promise.resolve(hasLocal() ? localStorage.setItem(key, value) : undefined)
      : SecureStore.setItemAsync(key, value),
  removeItem: (key) =>
    Platform.OS === 'web'
      ? Promise.resolve(hasLocal() ? localStorage.removeItem(key) : undefined)
      : SecureStore.deleteItemAsync(key),
};
