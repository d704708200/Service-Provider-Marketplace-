import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/common';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import CategoryServicesScreen from '../screens/home/CategoryServicesScreen';
import ServiceDetailScreen from '../screens/services/ServiceDetailScreen';
import ProvidersScreen from '../screens/providers/ProvidersScreen';
import ProviderDetailScreen from '../screens/providers/ProviderDetailScreen';
import RequestServiceScreen from '../screens/booking/RequestServiceScreen';
import BookingDetailScreen from '../screens/booking/BookingDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Restoring session..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="CategoryServices" component={CategoryServicesScreen} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          <Stack.Screen name="Providers" component={ProvidersScreen} />
          <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
          <Stack.Screen name="RequestService" component={RequestServiceScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
