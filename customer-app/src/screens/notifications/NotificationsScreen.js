import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Header
        title="Notifications"
        subtitle="Updates & Alerts"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications-outline" size={44} color={colors.primary} />
        </View>

        <Text style={styles.title}>No Notifications</Text>
        <Text style={styles.description}>
          You will receive real-time notifications here when providers accept your booking requests or update job statuses.
        </Text>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              Push notifications and booking status alert endpoints will be activated alongside the booking lifecycle in upcoming phases.
            </Text>
          </View>
        </Card>
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
    width: 80,
    height: 80,
    borderRadius: 40,
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
    maxWidth: 290,
    marginBottom: spacing.xl
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.slate50
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.slate600,
    flex: 1,
    lineHeight: 18
  }
});
