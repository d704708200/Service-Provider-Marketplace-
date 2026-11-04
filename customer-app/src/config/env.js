/**
 * Service Provider Marketplace - Customer App Environment Configuration
 *
 * Production Verified Backend (Render):
 * https://service-provider-marketplace.onrender.com/api
 */

// Production verified backend host (hosted on Render):
export const PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';
export const DEFAULT_PRODUCTION_API_URL = PRODUCTION_API_URL;

/**
 * Resolves the effective base API URL based on runtime environment.
 * In accordance with release requirements, the application strictly uses the
 * production Render backend and will not fall back to localhost, tunnels, or emulator loopbacks.
 */
export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  // If explicitly configured and valid HTTPS production endpoint:
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
    if (__DEV__) {
      console.warn(`[Customer App Config] Disallowed local/tunnel URL detected (${envUrl}). Reverting to Render Production URL.`);
    }
  }

  // Enforce Render Production backend URL as the absolute fallback across all platforms
  return PRODUCTION_API_URL;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT_MS: 20000
};

if (__DEV__) {
  console.log(`[Customer App Config] Active API URL: ${API_CONFIG.BASE_URL}`);
}

export default API_CONFIG;
