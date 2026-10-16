
import 'react-native-get-random-values';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

const ENCRYPTION_KEY_NAME = 'supabase-encryption-key';
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;

async function getEncryptionKey(): Promise<Uint8Array> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);

  if (!key) {
    const randomBytes = new Uint8Array(ENCRYPTION_KEY_LENGTH);
    crypto.getRandomValues(randomBytes);

    key = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
  }

  return new Uint8Array(
    key.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}

const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(key)
        : null;
    }

    const storedValue = await AsyncStorage.getItem(key);

    if (!storedValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(storedValue);

      // Support existing unencrypted sessions during migration.
      if (parsed.version !== 1 || !parsed.data) {
        return storedValue;
      }

      const encryptionKey = await getEncryptionKey();
      const iv = new Uint8Array(
        parsed.iv.match(/.{2}/g)!.map((byte: string) => parseInt(byte, 16)),
      );
      const encryptedBytes = new Uint8Array(
        parsed.data.match(/.{2}/g)!.map((byte: string) => parseInt(byte, 16)),
      );

      const aesCtr = new aesjs.ModeOfOperation.ctr(
        encryptionKey,
        new aesjs.Counter(iv),
      );

      const decryptedBytes = aesCtr.decrypt(encryptedBytes);

      return new TextDecoder().decode(decryptedBytes);
    } catch (error) {
      console.error('Unable to decrypt stored Supabase session:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return;
    }

    const encryptionKey = await getEncryptionKey();

    const iv = new Uint8Array(IV_LENGTH);
    crypto.getRandomValues(iv);

    const aesCtr = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(iv),
    );

    const encryptedBytes = aesCtr.encrypt(
      new TextEncoder().encode(value),
    );

    const toHex = (bytes: Uint8Array) =>
      Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');

    await AsyncStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        iv: toHex(iv),
        data: toHex(encryptedBytes),
      }),
    );
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return;
    }

    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
