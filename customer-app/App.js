import React, { useEffect } from 'react';
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

export default function App() {
  useEffect(() => {
    configureNotificationChannel();
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

