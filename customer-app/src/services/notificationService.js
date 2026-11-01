import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationApi } from './api';

const DEVICE_TOKEN_STORAGE_KEY = '@fcm_device_token';

// Configure foreground notification presentation behavior (native only; avoids web UnavailabilityError)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    })
  });
}

/**
 * Configure default Android notification channel for high-priority booking updates
 */
export const configureNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bookings & Alerts',
        description: 'Updates regarding booking requests, statuses, and messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#7C3AED',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
    } catch (err) {
      console.warn('[NotificationService] Channel configuration error:', err.message);
    }
  }
};

/**
 * Request notification permissions and obtain the registration token
 * On native (Android/iOS): Obtains native FCM device token
 * On web: Uses Web Push API only if VAPID key is configured; otherwise safely logs configuration warning
 */
export const requestPermissionAndGetToken = async () => {
  // --- WEB PLATFORM GUARD ---
  if (Platform.OS === 'web') {
    const vapidKey = process.env.EXPO_PUBLIC_VAPID_KEY;
    if (!vapidKey) {
      if (__DEV__) {
        console.warn(
          '[NotificationService] Web Push notifications require VAPID key configuration (EXPO_PUBLIC_VAPID_KEY). Web push token registration skipped.'
        );
      }
      return { granted: false, token: null, reason: 'vapid_missing' };
    }

    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return { granted: false, token: null, reason: 'permission_denied' };
        }
        const pushTokenData = await Notifications.getExpoPushTokenAsync({
          vapidPublicKey: vapidKey
        });
        return { granted: true, token: pushTokenData?.data, type: 'web' };
      }
      return { granted: false, token: null, reason: 'unsupported' };
    } catch (webErr) {
      console.warn('[NotificationService] Web notification permission/token error:', webErr?.message);
      return { granted: false, token: null, error: webErr?.message };
    }
  }

  // --- NATIVE MOBILE PLATFORM (Android / iOS) ---
  try {
    await configureNotificationChannel();

    // 1. Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true
        }
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Notification permission not granted');
      return { granted: false, token: null };
    }

    // 3. Obtain native FCM device token (not Expo push token)
    let tokenData = null;
    try {
      tokenData = await Notifications.getDevicePushTokenAsync();
    } catch (tokenErr) {
      console.warn(
        '[NotificationService] Native device push token fetch note (expected in Expo Go without native build):',
        tokenErr.message
      );
      return { granted: true, token: null, error: tokenErr.message };
    }

    const nativeToken = tokenData?.data;
    if (!nativeToken) {
      return { granted: true, token: null };
    }

    return { granted: true, token: nativeToken, type: tokenData.type };
  } catch (error) {
    console.warn('[NotificationService] Error requesting notification token:', error.message);
    return { granted: false, token: null, error: error.message };
  }
};

/**
 * Sync and register FCM device token with authenticated backend
 */
export const registerTokenWithBackend = async (role = 'customer') => {
  try {
    // On web, if no VAPID is configured, skip cleanly
    if (Platform.OS === 'web' && !process.env.EXPO_PUBLIC_VAPID_KEY) {
      return { success: false, reason: 'Web push not configured' };
    }

    const { granted, token } = await requestPermissionAndGetToken();

    if (!granted || !token) {
      return { success: false, reason: 'Token not available or permission denied' };
    }

    // Save locally to track changes
    await AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);

    // Register with backend API
    const response = await notificationApi.registerDeviceToken({
      token,
      platform: Platform.OS,
      deviceModel: Platform.OS === 'android' ? 'Android Device' : Platform.OS === 'ios' ? 'iOS Device' : 'Web Browser',
      appVersion: '1.0.0'
    });

    console.log('[NotificationService] Device token registered with backend successfully');
    return { success: true, token, data: response };
  } catch (err) {
    console.warn('[NotificationService] Token registration failed:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Unregister device token from backend on user logout
 */
export const unregisterTokenFromBackend = async () => {
  try {
    const storedToken = await AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (storedToken) {
      await notificationApi.unregisterDeviceToken(storedToken);
      await AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
      console.log('[NotificationService] Device token unregistered on logout');
    }
    return { success: true };
  } catch (err) {
    console.warn('[NotificationService] Failed to unregister token on logout:', err.message);
    return { success: false };
  }
};

/**
 * Initialize notification listeners for foreground reception and tap navigation
 */
export const initNotificationListeners = (navigationRef, onForegroundNotification) => {
  // On web, avoid calling native-only listener methods and return clean no-op
  if (Platform.OS === 'web') {
    return () => {};
  }

  let receivedSubscription = null;
  let responseSubscription = null;

  try {
    // 1. Foreground listener
    receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      if (typeof onForegroundNotification === 'function') {
        onForegroundNotification(notification);
      }
    });

    // 2. Tap / Response listener (when user interacts with notification banner)
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response, navigationRef);
    });

    // 3. Cold launch check (app opened by tapping a notification when killed) - native only with safe catch
    if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            handleNotificationTap(response, navigationRef);
          }
        })
        .catch((err) => {
          if (__DEV__) {
            console.warn('[NotificationService] getLastNotificationResponseAsync note:', err?.message);
          }
        });
    }
  } catch (listenerErr) {
    console.warn('[NotificationService] Error initializing native notification listeners:', listenerErr?.message);
  }

  return () => {
    try {
      if (receivedSubscription?.remove) receivedSubscription.remove();
      if (responseSubscription?.remove) responseSubscription.remove();
    } catch (e) {
      // Ignore unsubscribe errors
    }
  };
};

/**
 * Handle notification tap and navigate to the relevant entity (e.g. BookingDetail)
 */
const handleNotificationTap = (response, navigationRef) => {
  try {
    const data = response?.notification?.request?.content?.data || {};
    const bookingId = data.bookingId;

    if (bookingId && navigationRef?.isReady?.() && navigationRef?.navigate) {
      navigationRef.navigate('BookingDetail', { bookingId, id: bookingId });
    }
  } catch (err) {
    console.warn('[NotificationService] Error handling notification tap navigation:', err.message);
  }
};

export default {
  configureNotificationChannel,
  requestPermissionAndGetToken,
  registerTokenWithBackend,
  unregisterTokenFromBackend,
  initNotificationListeners
};
