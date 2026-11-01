import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationApi } from './api';

const DEVICE_TOKEN_STORAGE_KEY = '@fcm_provider_device_token';

// Configure foreground notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

/**
 * Configure default Android notification channel for high-priority provider booking alerts
 */
export const configureNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Booking Requests & Jobs',
        description: 'Instant alerts for new booking requests, job changes, and cancellations',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        enableLights: true,
        lightColor: '#8B5CF6',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
      });
    } catch (err) {
      console.warn('[ProviderNotification] Channel configuration error:', err.message);
    }
  }
};

/**
 * Request notification permissions and obtain the native FCM registration token
 */
export const requestPermissionAndGetToken = async () => {
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
      console.log('[ProviderNotification] Notification permission not granted');
      return { granted: false, token: null };
    }

    // 3. Obtain native FCM device token
    let tokenData = null;
    try {
      tokenData = await Notifications.getDevicePushTokenAsync();
    } catch (tokenErr) {
      console.warn(
        '[ProviderNotification] Native device push token fetch note (expected in Expo Go without native build):',
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
    console.warn('[ProviderNotification] Error requesting notification token:', error.message);
    return { granted: false, token: null, error: error.message };
  }
};

/**
 * Sync and register FCM device token with authenticated backend
 */
export const registerTokenWithBackend = async (role = 'provider') => {
  try {
    const { granted, token } = await requestPermissionAndGetToken();

    if (!granted || !token) {
      return { success: false, reason: 'Token not available or permission denied' };
    }

    // Save locally
    await AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);

    // Register with backend API
    const response = await notificationApi.registerDeviceToken({
      token,
      platform: Platform.OS,
      deviceModel: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
      appVersion: '1.0.0'
    });

    console.log('[ProviderNotification] Provider device token registered with backend successfully');
    return { success: true, token, data: response };
  } catch (err) {
    console.warn('[ProviderNotification] Token registration failed:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Unregister device token from backend on provider logout
 */
export const unregisterTokenFromBackend = async () => {
  try {
    const storedToken = await AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    await notificationApi.unregisterDeviceToken(storedToken || '');
    await AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
    console.log('[ProviderNotification] Provider device token unregistered on logout');
    return { success: true };
  } catch (err) {
    console.warn('[ProviderNotification] Failed to unregister token on logout:', err.message);
    return { success: false };
  }
};

/**
 * Initialize notification listeners for foreground reception and tap navigation
 */
export const initNotificationListeners = (navigationRef, onForegroundNotification) => {
  // 1. Foreground listener
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    if (typeof onForegroundNotification === 'function') {
      onForegroundNotification(notification);
    }
  });

  // 2. Tap / Response listener
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationTap(response, navigationRef);
  });

  // 3. Cold launch check
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      handleNotificationTap(response, navigationRef);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

/**
 * Handle notification tap and navigate to the relevant booking
 */
const handleNotificationTap = (response, navigationRef) => {
  try {
    const data = response?.notification?.request?.content?.data || {};
    const bookingId = data.bookingId;

    if (bookingId && navigationRef?.isReady?.() && navigationRef?.navigate) {
      navigationRef.navigate('BookingDetail', { bookingId, id: bookingId });
    }
  } catch (err) {
    console.warn('[ProviderNotification] Error handling notification tap navigation:', err.message);
  }
};

export default {
  configureNotificationChannel,
  requestPermissionAndGetToken,
  registerTokenWithBackend,
  unregisterTokenFromBackend,
  initNotificationListeners
};
