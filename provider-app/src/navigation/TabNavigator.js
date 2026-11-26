import React from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import RequestsScreen from '../screens/requests/RequestsScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProviderServicesScreen from '../screens/services/ProviderServicesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { useRequests } from '../context/RequestContext';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { pendingRequestsCount } = useRequests();
  const { colors, isDark } = useTheme();

  // Dynamically compute bottom padding and total height to support:
  // 1. Android 3-button navigation (insets.bottom ~48dp)
  // 2. Android gesture navigation pill (insets.bottom ~16-24dp)
  // 3. Android zero-inset legacy navigation (fallback 8dp)
  // 4. iOS Home Indicator (insets.bottom ~34dp)
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#A78BFA' : colors.primary,
        tabBarInactiveTintColor: isDark ? '#71717A' : colors.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: isDark ? '#0F0E16' : colors.card,
            borderTopColor: isDark ? '#1F1C2B' : colors.border,
            height: tabBarHeight,
            paddingBottom: bottomPadding,
            paddingTop: 6
          }
        ],
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
              {focused && (
                <View
                  style={[
                    styles.activePill,
                    { backgroundColor: isDark ? '#8B5CF6' : colors.primary }
                  ]}
                />
              )}
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
        options={{
          tabBarLabel: 'Requests',
          tabBarBadge:
            pendingRequestsCount > 0
              ? pendingRequestsCount > 99
                ? '99+'
                : pendingRequestsCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700'
          }
        }}
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
    borderTopWidth: 1,
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
