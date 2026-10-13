import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/home/HomeScreen';
import ServicesScreen from '../screens/services/ServicesScreen';
import ProvidersScreen from '../screens/providers/ProvidersScreen';
import BookingHistoryScreen from '../screens/history/BookingHistoryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import colors from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ServicesTab') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'ProvidersTab') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'BookingsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size || 22} color={color} />;
        }
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="ServicesTab"
        component={ServicesScreen}
        options={{ tabBarLabel: 'Services' }}
      />
      <Tab.Screen
        name="ProvidersTab"
        component={ProvidersScreen}
        options={{ tabBarLabel: 'Providers' }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingHistoryScreen}
        options={{ tabBarLabel: 'Bookings' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600'
  }
});
