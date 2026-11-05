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
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
import WithdrawScreen from '../screens/wallet/WithdrawScreen';
import ReviewsScreen from '../screens/reviews/ReviewsScreen';

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
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Availability" component={AvailabilityScreen} />
          <Stack.Screen name="ServiceAreas" component={ServiceAreasScreen} />
          <Stack.Screen name="OfferedServices" component={ProviderServicesScreen} />
          <Stack.Screen name="KYC" component={KYCScreen} />
          <Stack.Screen name="Wallet" component={WalletScreen} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} />
          <Stack.Screen name="Reviews" component={ReviewsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
