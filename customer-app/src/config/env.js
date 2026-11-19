import { Platform } from 'react-native';

/**
 * Service Provider Marketplace - Customer App Environment Configuration
 *
 * Production Verified Backend (Render):
 * https://service-provider-marketplace.onrender.com/api
 */

// Production verified backend host (hosted on Render):
export const PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';
export const DEFAULT_PRODUCTION_API_URL = PRODUCTION_API_URL;
export const LOCALHOST_API_URL = 'http://localhost:5000/api';
export const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:5000/api';

/**
 * Resolves the effective base API URL based on runtime environment.
 * In development (__DEV__), local backend is permitted and automatically routes
 * to localhost on Web and 10.0.2.2 on Android Emulator.
 * In production release builds, Render backend is enforced as fallback.
 */
export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // In production release builds, disallow localhost/tunnels and enforce production HTTPS
  if (!__DEV__) {
    if (envUrl && envUrl.length > 0) {
      const isDisallowed =
        envUrl.includes('localhost') ||
        envUrl.includes('127.0.0.1') ||
        envUrl.includes('10.0.2.2') ||
        envUrl.includes('trycloudflare') ||
        envUrl.includes('ngrok');
      if (!isDisallowed) {
        return envUrl;
      }
    }
    return PRODUCTION_API_URL;
  }

  // In development (__DEV__):
  if (envUrl && envUrl.length > 0) {
    if (Platform.OS === 'android') {
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return ANDROID_EMULATOR_API_URL;
      }
    }
    return envUrl;
  }

  // Development defaults:
  if (Platform.OS === 'android') {
    return ANDROID_EMULATOR_API_URL;
  }

  return LOCALHOST_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT_MS: 20000
};

if (__DEV__) {
  console.log(`[Customer App Config] Active API URL: ${API_CONFIG.BASE_URL}`);
}

export default API_CONFIG;
