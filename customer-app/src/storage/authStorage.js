import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

export const authStorage = {
  setToken: async (token) => {
    try {
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    } catch (e) {
      console.error('Error saving auth token to storage:', e);
    }
  },

  getToken: async () => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (e) {
      console.error('Error reading auth token from storage:', e);
      return null;
    }
  },

  setUser: async (user) => {
    try {
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (e) {
      console.error('Error saving user data to storage:', e);
    }
  },

  getUser: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading user data from storage:', e);
      return null;
    }
  },

  clearAuth: async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
    } catch (e) {
      console.error('Error clearing auth data from storage:', e);
    }
  },

  getAuthData: async () => {
    try {
      const [[, token], [, userStr]] = await AsyncStorage.multiGet([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.USER
      ]);
      const user = userStr ? JSON.parse(userStr) : null;
      return { token, user };
    } catch (e) {
      console.error('Error reading multi auth data:', e);
      return { token: null, user: null };
    }
  }
};

export default authStorage;
