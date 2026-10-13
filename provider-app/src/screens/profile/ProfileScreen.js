import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Header, Card, Badge, Button } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() }
    ]);
  };

  const businessName = profile?.businessName || user?.name || 'Service Partner';
  const verificationStatus = profile?.verificationStatus || 'pending';

  return (
    <View style={styles.container}>
      <Header
        title="Provider Account"
        subtitle="Business Profile & Settings"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Ionicons name="business" size={32} color={colors.primary} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.name}>{businessName}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <Badge
                label={verificationStatus.toUpperCase()}
                variant={
                  verificationStatus === 'verified'
                    ? 'success'
                    : verificationStatus === 'pending'
                    ? 'warning'
                    : 'danger'
                }
                size="sm"
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
        </Card>

        {/* Performance Stats */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{profile?.completedBookingsCount || 0}</Text>
              <Text style={styles.statLabel}>Completed Jobs</Text>
            </View>

            <View style={styles.statBox}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.statVal}>
                  {profile?.rating?.average ? profile.rating.average.toFixed(1) : '5.0'}
                </Text>
              </View>
              <Text style={styles.statLabel}>Rating</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statVal}>{profile?.experienceYears || 1}+ yrs</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          </View>
        </Card>

        {/* Business Info */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Contact Phone</Text>
            <Text style={styles.val}>{user?.phone || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Account Role</Text>
            <Text style={styles.val}>Verified Provider</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Availability</Text>
            <Badge
              label={profile?.isAvailable ? 'AVAILABLE' : 'OFFLINE'}
              variant={profile?.isAvailable ? 'success' : 'slate'}
              size="sm"
            />
          </View>
        </Card>

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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    marginBottom: spacing.lg
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1
  },
  name: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  email: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginBottom: 2
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: spacing.md
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    marginHorizontal: 4
  },
  statVal: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  statLabel: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  label: {
    ...typography.bodySmall,
    color: colors.slate500
  },
  val: {
    ...typography.bodySmall,
    color: colors.slate800,
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.xs
  },
  logoutBtn: {
    marginTop: spacing.sm
  }
});
