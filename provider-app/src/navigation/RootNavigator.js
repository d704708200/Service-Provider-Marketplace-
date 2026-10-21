import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/common';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import BookingDetailScreen from '../screens/requests/BookingDetailScreen';
import AvailabilityScreen from '../screens/availability/AvailabilityScreen';
import ServiceAreasScreen from '../screens/profile/ServiceAreasScreen';
import ProviderServicesScreen from '../screens/services/ProviderServicesScreen';
import KYCScreen from '../screens/profile/KYCScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Checking session..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
          <Stack.Screen name="Availability" component={AvailabilityScreen} />
          <Stack.Screen name="ServiceAreas" component={ServiceAreasScreen} />
          <Stack.Screen name="OfferedServices" component={ProviderServicesScreen} />
          <Stack.Screen name="KYC" component={KYCScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
