import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../theme';

export default function BookingDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!bookingId) return;
    try {
      setError(null);
      const res = await bookingApi.getBookingById(bookingId);
      setBooking(res.data);
    } catch (err) {
      setError(err.userMessage || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleStartService = async () => {
    setActionLoading(true);
    try {
      const res = await bookingApi.startService(booking._id);
      if (res?.success) {
        Alert.alert('Service Started', 'Service is now marked in progress.');
        setBooking(res.data);
      }
    } catch (err) {
      Alert.alert('Error', err.userMessage || 'Could not start service');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteService = async () => {
    Alert.alert(
      'Complete Service',
      'Are you sure you want to mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Completed',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await bookingApi.completeService(booking._id);
              if (res?.success) {
                Alert.alert('Service Completed', 'Job completed successfully! Order recorded.');
                setBooking(res.data);
              }
            } catch (err) {
              Alert.alert('Error', err.userMessage || 'Could not complete service');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleAcceptRequest = async () => {
    setActionLoading(true);
    try {
      const res = await bookingApi.acceptBooking(booking._id);
      if (res?.success) {
        Alert.alert('Accepted', 'You have claimed this booking.');
        setBooking(res.data);
      }
    } catch (err) {
      Alert.alert('Error', err.userMessage || 'Could not accept booking');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading booking details..." />;
  }

  if (error || !booking) {
    return (
      <View style={styles.container}>
        <Header title="Booking Details" showBack onBack={() => navigation.goBack()} />
        <ErrorView message={error || 'Booking not found'} onRetry={fetchDetail} />
      </View>
    );
  }

  const isInstant = booking.bookingMode === 'instant';
  const scheduleText = isInstant
    ? 'ASAP (Instant)'
    : booking.scheduledDate
    ? `${new Date(booking.scheduledDate).toLocaleDateString()} (${booking.scheduledTimeSlot?.startTime || ''} - ${booking.scheduledTimeSlot?.endTime || ''})`
    : 'N/A';

  return (
    <View style={styles.container}>
      <Header
        title={booking.bookingReference}
        subtitle="Booking Management"
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Card style={styles.card}>
          <View style={styles.statusHeaderRow}>
            <View>
              <Text style={styles.serviceName}>{booking.service?.name}</Text>
              <Text style={styles.reference}>{booking.bookingReference}</Text>
            </View>
            <Badge
              label={booking.status.toUpperCase()}
              variant={
                booking.status === 'completed'
                  ? 'success'
                  : booking.status === 'in_progress'
                  ? 'primary'
                  : booking.status === 'accepted'
                  ? 'secondary'
                  : booking.status === 'cancelled'
                  ? 'danger'
                  : 'warning'
              }
              size="md"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Order Total</Text>
            <Text style={styles.price}>
              ₹{booking.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Mode</Text>
            <Text style={styles.metaVal}>{isInstant ? 'Instant Request' : 'Scheduled'}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Schedule</Text>
            <Text style={styles.metaVal}>{scheduleText}</Text>
          </View>
        </Card>

        {/* Customer & Location Details */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Customer & Service Location</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoTitle}>{booking.customer?.user?.name || 'Customer'}</Text>
              <Text style={styles.infoSub}>{booking.customer?.user?.phone || 'No phone'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <View style={styles.infoCol}>
              <Text style={styles.infoTitle}>Service Address</Text>
              <Text style={styles.infoSub}>
                {booking.address?.street}, {booking.address?.city} {booking.address?.zipCode}
              </Text>
            </View>
          </View>

          {booking.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesHeading}>Customer Problem Description:</Text>
              <Text style={styles.notesBody}>{booking.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Timeline & Timestamps */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Status Timeline</Text>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Created At</Text>
            <Text style={styles.timelineVal}>
              {new Date(booking.createdAt).toLocaleString()}
            </Text>
          </View>
          {booking.statusTimestamps?.acceptedAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Accepted At</Text>
              <Text style={styles.timelineVal}>
                {new Date(booking.statusTimestamps.acceptedAt).toLocaleString()}
              </Text>
            </View>
          )}
          {booking.statusTimestamps?.inProgressAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Started At</Text>
              <Text style={styles.timelineVal}>
                {new Date(booking.statusTimestamps.inProgressAt).toLocaleString()}
              </Text>
            </View>
          )}
          {booking.statusTimestamps?.completedAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Completed At</Text>
              <Text style={styles.timelineVal}>
                {new Date(booking.statusTimestamps.completedAt).toLocaleString()}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Action Footer */}
      {(booking.status === 'pending' ||
        booking.status === 'accepted' ||
        booking.status === 'in_progress') && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {booking.status === 'pending' && (
            <Button
              title={actionLoading ? 'Claiming...' : 'Accept & Claim Job'}
              variant="primary"
              loading={actionLoading}
              disabled={actionLoading}
              onPress={handleAcceptRequest}
              style={styles.actionBtn}
            />
          )}

          {booking.status === 'accepted' && (
            <Button
              title={actionLoading ? 'Starting...' : 'Start Service (In Progress)'}
              variant="primary"
              loading={actionLoading}
              disabled={actionLoading}
              onPress={handleStartService}
              style={styles.actionBtn}
            />
          )}

          {booking.status === 'in_progress' && (
            <Button
              title={actionLoading ? 'Completing...' : 'Mark Job Completed'}
              variant="success"
              loading={actionLoading}
              disabled={actionLoading}
              onPress={handleCompleteService}
              style={styles.actionBtn}
            />
          )}
        </View>
      )}
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
  card: {
    marginBottom: spacing.md
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  reference: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.md
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  metaLabel: {
    ...typography.bodySmall,
    color: colors.slate500
  },
  metaVal: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.slate800
  },
  price: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: spacing.md
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  infoCol: {
    flex: 1
  },
  infoTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.slate900
  },
  infoSub: {
    ...typography.bodySmall,
    color: colors.slate600,
    marginTop: 2
  },
  notesBox: {
    backgroundColor: colors.slate50,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs
  },
  notesHeading: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 2
  },
  notesBody: {
    ...typography.bodySmall,
    color: colors.slate700
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  timelineLabel: {
    ...typography.bodySmall,
    color: colors.slate500
  },
  timelineVal: {
    ...typography.bodySmall,
    color: colors.slate800,
    fontWeight: '500'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadows.elevated
  },
  actionBtn: {
    width: '100%'
  }
});
