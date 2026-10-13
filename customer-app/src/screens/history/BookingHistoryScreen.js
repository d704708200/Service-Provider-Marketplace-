import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function BookingHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Header
        title="My Bookings"
        subtitle="Active & Past Requests"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="calendar-outline" size={48} color={colors.primary} />
        </View>

        <Text style={styles.title}>No Active Bookings</Text>
        <Text style={styles.description}>
          Your service requests, appointments, and live booking updates will appear here once booked.
        </Text>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoHeading}>Booking Phase Integration</Text>
              <Text style={styles.infoText}>
                Live booking lifecycle (`/api/bookings`) is scheduled for Phase 10. You can browse active services and verified providers now.
              </Text>
            </View>
          </View>
        </Card>

        <Button
          title="Explore Services"
          onPress={() => navigation.navigate('ServicesTab')}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg
  },
  title: {
    ...typography.titleMedium,
    color: colors.slate900,
    marginBottom: spacing.xs
  },
  description: {
    ...typography.bodyMedium,
    color: colors.slate600,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.xl
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.slate50,
    borderColor: colors.border,
    marginBottom: spacing.xxl
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start'
  },
  infoCol: {
    flex: 1
  },
  infoHeading: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 2
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.slate600,
    lineHeight: 18
  },
  actionBtn: {
    minWidth: 200
  }
});
