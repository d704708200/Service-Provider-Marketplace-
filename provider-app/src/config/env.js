/**
 * Service Provider Marketplace - Provider App Environment Configuration
 *
 * Production Verified Backend (Render):
 * https://service-provider-marketplace.onrender.com/api
 */

// Production verified backend host (hosted on Render):
export const PRODUCTION_API_URL = 'https://service-provider-marketplace.onrender.com/api';

/**
 * Resolves the effective base API URL based on runtime environment.
 * Default is ALWAYS the production cloud API URL (Render).
 * Localhost, emulator loopbacks, and tunnels are explicitly disallowed in production configuration.
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
      console.warn(`[Provider App Config] Disallowed local/tunnel URL detected (${envUrl}). Reverting to Render Production URL.`);
    }
  }

  // Enforce Render Production backend URL as the absolute fallback
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
