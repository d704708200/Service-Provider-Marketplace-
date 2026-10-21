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
export const DEFAULT_PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';

// Current machine LAN address discovered via network configuration:
export const DEV_LAN_API_URL = 'http://192.168.1.2:5000/api';

// Android Emulator host loopback alias:
export const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:5000/api';

// Localhost endpoint for local backend development:
export const LOCALHOST_API_URL = 'http://localhost:5000/api';

/**
 * Resolves the effective base API URL based on runtime environment.
 */
export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // If explicitly configured in environment:
  if (envUrl && envUrl.length > 0) {
    if (Platform.OS === 'android') {
      if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        // If Android emulator or device with local backend configured, map localhost to emulator host
        return ANDROID_EMULATOR_API_URL;
      }
    }
    return envUrl;
  }

  // Release builds fallback when no env variable is provided:
  if (!__DEV__) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  // Development default: verified Render backend
  return DEFAULT_PRODUCTION_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT_MS: 20000
};

export default API_CONFIG;
