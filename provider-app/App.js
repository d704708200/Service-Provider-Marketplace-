import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { RequestProvider } from './src/context/RequestContext';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotificationChannel } from './src/services/notificationService';
import { setupGlobalScrollbars } from './src/utils/scrollbars';

export const navigationRef = createNavigationContainerRef();
if (typeof window !== 'undefined') {
  window.__navigationRef = navigationRef;
}

// Initialize global scrollbar hiding and smooth scrolling
setupGlobalScrollbars();

function AppContent() {
  const { statusBarStyle, navigationTheme, colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />
      <AuthProvider>
        <NotificationProvider navigationRef={navigationRef}>
          <RequestProvider>
            <NavigationContainer ref={navigationRef} theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          </RequestProvider>
        </NotificationProvider>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    configureNotificationChannel();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
