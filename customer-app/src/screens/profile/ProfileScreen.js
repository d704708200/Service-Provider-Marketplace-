import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Header, Card, Badge, Button } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile, logout, checkAuthSession } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkAuthSession();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    : 'Recently';

  return (
    <View style={styles.container}>
      <Header
        title="My Account"
        subtitle="Profile & Settings"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Customer'}
                </Text>
                <Badge label="Customer" variant="primary" size="sm" />
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email}
              </Text>
              <Text style={styles.userPhone}>{user?.phone || 'No phone set'}</Text>
            </View>
          </View>
        </Card>

        {/* Account Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="mail-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Email</Text>
            </View>
            <Text style={styles.detailValue}>{user?.email}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="call-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Phone</Text>
            </View>
            <Text style={styles.detailValue}>{user?.phone || 'Not provided'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="calendar-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Member Since</Text>
            </View>
            <Text style={styles.detailValue}>{memberSince}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Account Status</Text>
            </View>
            <Badge label="Active" variant="success" size="sm" />
          </View>
        </Card>

        {/* Addresses Info Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Saved Addresses</Text>
          {profile?.addresses && profile.addresses.length > 0 ? (
            profile.addresses.map((addr, idx) => (
              <View key={idx} style={styles.addressBox}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <View style={styles.addressTextCol}>
                  <Text style={styles.addressStreet}>{addr.street}</Text>
                  <Text style={styles.addressCity}>
                    {addr.city}, {addr.state} - {addr.postalCode}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyAddress}>
              <Ionicons name="home-outline" size={20} color={colors.slate400} />
              <Text style={styles.emptyAddressText}>
                No saved address yet. Service addresses are provided directly during service requests.
              </Text>
            </View>
          )}
        </Card>

        {/* App Info Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Application Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Marketplace Version</Text>
            <Text style={styles.detailValue}>1.0.0 (Phase 9)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>API Endpoint</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api'}
            </Text>
          </View>
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="danger"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.lg
  },
  profileCard: {
    marginBottom: spacing.lg
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg
  },
  userInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  userName: {
    ...typography.titleSmall,
    color: colors.slate900,
    flex: 1,
    marginRight: spacing.sm
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginBottom: 2
  },
  userPhone: {
    ...typography.caption,
    color: colors.slate400
  },
  sectionCard: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: spacing.md
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.slate600
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.slate900,
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.sm
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.slate50,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs
  },
  addressTextCol: {
    flex: 1
  },
  addressStreet: {
    ...typography.bodyMedium,
    color: colors.slate900,
    fontWeight: '500'
  },
  addressCity: {
    ...typography.bodySmall,
    color: colors.slate500
  },
  emptyAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  emptyAddressText: {
    ...typography.bodySmall,
    color: colors.slate500,
    flex: 1,
    lineHeight: 18
  },
  logoutBtn: {
    marginTop: spacing.sm
  }
});
