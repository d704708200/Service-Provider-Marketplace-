import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@provider_auth_token';
const USER_KEY = '@provider_user_data';
const PROFILE_KEY = '@provider_profile_data';

export const authStorage = {
  setToken: async (token) => {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to store provider auth token:', e);
    }
  },

  getToken: async () => {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (e) {
      console.error('Failed to read provider auth token:', e);
      return null;
    }
  },

  setUser: async (user) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to store provider user:', e);
    }
  },

  getUser: async () => {
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to read provider user:', e);
      return null;
    }
  },

  setProfile: async (profile) => {
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to store provider profile:', e);
    }
  },

  getProfile: async () => {
    try {
      const data = await AsyncStorage.getItem(PROFILE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to read provider profile:', e);
      return null;
    }
  },

  clearAuth: async () => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, PROFILE_KEY]);
    } catch (e) {
      console.error('Failed to clear provider auth storage:', e);
    }
  }
};

export default authStorage;
