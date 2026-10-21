import { Platform } from 'react-native';

/**
 * Service Provider Marketplace - Provider App Environment Configuration
 *
 * Target Priority:
 * 1. Explicit `EXPO_PUBLIC_API_URL` set in environment (.env or build configuration)
 *    - If pointing to localhost and in browser development, verify if localhost or cloud backend should be used.
 *    - If running on Android and using localhost, automatically route to development LAN host or Android Emulator (10.0.2.2).
 * 2. Fallback for release builds: Production verified backend host.
 * 3. Fallback for development: Production verified cloud backend (so browser/mobile works even if local node backend is not running).
 */

// Production verified backend host (hosted on Render):
export const PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';

// Android Emulator host loopback alias (for local backend debugging):
export const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:5000/api';

/**
 * Resolves the effective base API URL based on runtime environment.
 * Default is ALWAYS the production cloud API URL (Render) so that the app works
 * out of the box without requiring a local backend server to be running.
 *
 * To explicitly use a local backend, set EXPO_PUBLIC_USE_LOCAL_BACKEND=true or
 * EXPO_PUBLIC_API_URL=http://localhost:5000/api in provider-app/.env
 */
export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // If explicitly configured in environment:
  if (envUrl && envUrl.length > 0) {
    if (Platform.OS === 'android' && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return ANDROID_EMULATOR_API_URL;
    }
    return envUrl;
  }

  // Default is ALWAYS the verified Render production cloud backend
  return PRODUCTION_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT_MS: 20000
};

// Safe startup diagnostic log (without logging any credentials, tokens, or secrets)
if (__DEV__) {
  console.log(`[Provider App Config] Resolved Base API URL: ${API_CONFIG.BASE_URL}`);
}

export default API_CONFIG;
