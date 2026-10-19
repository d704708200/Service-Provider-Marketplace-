import { Platform } from 'react-native';

/**
 * Service Provider Marketplace - Customer App Environment Configuration
 * 
 * Target Priority:
 * 1. Explicit `EXPO_PUBLIC_API_URL` set in environment (.env or build configuration)
 * 2. If running on Android and using localhost, automatically route to the current development LAN host (192.168.1.2)
 *    or Android Emulator (10.0.2.2).
 * 3. Default fallback for web/standard local development.
 */

// Production verified backend host:
// Set this when deploying or building the release APK (e.g. verified Render host or custom domain).
export const DEFAULT_PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';

// Current machine LAN address discovered via network configuration (Ethernet/Wi-Fi):
export const DEV_LAN_API_URL = 'http://192.168.1.2:5000/api';

// Android Emulator host loopback alias:
export const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:5000/api';

// Fallback localhost endpoint for browser/web development:
export const LOCALHOST_API_URL = 'http://localhost:5000/api';

/**
 * Resolves the effective base API URL based on runtime environment.
 */
export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // If explicitly configured, use it directly (converting localhost to LAN IP on Android)
  if (envUrl && envUrl.length > 0) {
    if (Platform.OS === 'android') {
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return DEV_LAN_API_URL;
      }
    }
    return envUrl;
  }

  // Release builds fallback when no env variable is provided:
  if (!__DEV__) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  // Development defaults:
  if (Platform.OS === 'android') {
    return DEV_LAN_API_URL;
  }

  return LOCALHOST_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT_MS: 15000
};

export default API_CONFIG;
