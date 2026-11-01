import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { NotificationProvider } from './src/context/NotificationContext';
import LocationPermissionModal from './src/components/common/LocationPermissionModal';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotificationChannel } from './src/services/notificationService';

export const navigationRef = createNavigationContainerRef();

if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
  window.__navigationRef = navigationRef;
}

export default function App() {
  useEffect(() => {
    configureNotificationChannel();

    // Guard against external browser extension runtime errors (e.g. M_ID property accesses from third-party extensions)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleGlobalError = (event) => {
        const errorMsg = event?.message || event?.error?.message || '';
        if (typeof errorMsg === 'string' && errorMsg.includes('M_ID')) {
          if (__DEV__) {
            console.info('[CustomerApp] Caught external browser extension error (M_ID): safely preventing host app crash.');
          }
          event.preventDefault?.();
        }
      };

      const handleUnhandledRejection = (event) => {
        const reason = event?.reason?.message || event?.reason || '';
        if (typeof reason === 'string' && reason.includes('M_ID')) {
          if (__DEV__) {
            console.info('[CustomerApp] Caught external browser extension unhandled rejection (M_ID): safely handled.');
          }
          event.preventDefault?.();
        }
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleGlobalError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <LocationProvider>
          <NotificationProvider navigationRef={navigationRef}>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              <LocationPermissionModal />
            </NavigationContainer>
          </NotificationProvider>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

