import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { RequestProvider } from './src/context/RequestContext';
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
        <NotificationProvider navigationRef={navigationRef}>
          <RequestProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
          </RequestProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
