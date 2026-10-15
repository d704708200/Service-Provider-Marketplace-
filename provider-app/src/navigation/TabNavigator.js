import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import RequestsScreen from '../screens/requests/RequestsScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProviderServicesScreen from '../screens/services/ProviderServicesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import colors from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#A78BFA',
        tabBarInactiveTintColor: '#71717A',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'RequestsTab') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'HistoryTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'ServicesTab') {
            iconName = focused ? 'construct' : 'construct-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={20} color={color} />
              {focused && <View style={styles.activePill} />}
            </View>
          );
        }
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="RequestsTab"
        component={RequestsScreen}
        options={{ tabBarLabel: 'Requests' }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{ tabBarLabel: 'Bookings' }}
      />
      <Tab.Screen
        name="ServicesTab"
        component={ProviderServicesScreen}
        options={{ tabBarLabel: 'Services' }}
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
    backgroundColor: '#0F0E16',
    borderTopWidth: 1,
    borderTopColor: '#1F1C2B',
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    elevation: 0
  },
  tabBarItem: {
    paddingVertical: 2
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 26
  },
  activePill: {
    position: 'absolute',
    bottom: -6,
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#8B5CF6'
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2
  }
});
