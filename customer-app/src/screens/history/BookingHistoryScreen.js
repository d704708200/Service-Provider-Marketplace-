import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
];

export default function BookingHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      const res = await bookingApi.getMyBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      setError(err.userMessage || err.message || 'Unable to load booking history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${booking.bookingReference}?`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking._id);
            try {
              await bookingApi.cancelBooking(booking._id, 'Customer cancelled via mobile app');
              Alert.alert('Booking Cancelled', 'Your booking request has been cancelled.');
              fetchBookings();
            } catch (err) {
              Alert.alert(
                'Cancellation Failed',
                err.userMessage || err.message || 'Unable to cancel booking'
              );
            } finally {
              setCancellingId(null);
            }
          }
        }
      ]
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return { label: 'ACCEPTED', variant: 'secondary' };
      case 'in_progress':
        return { label: 'IN PROGRESS', variant: 'primary' };
      case 'completed':
        return { label: 'COMPLETED', variant: 'success' };
      case 'cancelled':
        return { label: 'CANCELLED', variant: 'danger' };
      case 'rejected':
        return { label: 'REJECTED', variant: 'danger' };
      case 'pending':
      default:
        return { label: 'PENDING', variant: 'warning' };
    }
  };

  const renderBookingCard = ({ item }) => {
    const badge = getStatusBadge(item.status);
    const isCancellable = item.status === 'pending' || item.status === 'accepted';
    const isInstant = item.bookingMode === 'instant';

    const scheduleText = isInstant
      ? 'ASAP (Instant)'
      : item.scheduledDate
      ? `${new Date(item.scheduledDate).toLocaleDateString()} (${item.scheduledTimeSlot?.startTime || ''} - ${item.scheduledTimeSlot?.endTime || ''})`
      : 'Scheduled';

    const providerName =
      item.provider?.businessName ||
      item.provider?.user?.name ||
      (isInstant && item.status === 'pending' ? 'Matching Verified Provider...' : 'Assigned Provider');

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.reference}>{item.bookingReference}</Text>
            <Text style={styles.serviceTitle}>{item.service?.name || 'Service Request'}</Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} size="sm" />
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="business-outline" size={16} color={colors.slate400} />
          <Text style={styles.detailText} numberOfLines={1}>
            {providerName}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.slate400} />
          <Text style={styles.detailText}>{scheduleText}</Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.slate400} />
          <Text style={styles.detailText} numberOfLines={1}>
            {item.address?.street}, {item.address?.city}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total: </Text>
            <Text style={styles.priceAmount}>
              ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
            </Text>
          </View>

          {isCancellable && (
            <Button
              title={cancellingId === item._id ? 'Cancelling...' : 'Cancel'}
              variant="outline"
              size="sm"
              disabled={cancellingId === item._id}
              onPress={() => handleCancelBooking(item)}
              textStyle={styles.cancelBtnText}
              style={styles.cancelBtn}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="My Bookings"
        subtitle="Manage & Track Service Requests"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterTab,
                selectedStatus === f.value && styles.filterTabActive
              ]}
              onPress={() => setSelectedStatus(f.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  selectedStatus === f.value && styles.filterTabTextActive
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <LoadingScreen message="Loading bookings..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchBookings} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Bookings Found"
              description={
                selectedStatus === 'all'
                  ? 'You have not placed any service bookings yet. Explore our verified services to get started!'
                  : `You have no ${selectedStatus.replace('_', ' ')} bookings.`
              }
              actionTitle="Explore Services"
              onAction={() => navigation.navigate('ServicesTab')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  filterSection: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.slate100,
    marginRight: spacing.xs
  },
  filterTabActive: {
    backgroundColor: colors.primary
  },
  filterTabText: {
    ...typography.caption,
    color: colors.slate700,
    fontWeight: '600'
  },
  filterTabTextActive: {
    color: colors.white
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  reference: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 2
  },
  serviceTitle: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.slate600,
    flex: 1
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  priceLabel: {
    ...typography.caption,
    color: colors.slate500
  },
  priceAmount: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  cancelBtn: {
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: 4
  },
  cancelBtnText: {
    color: colors.danger,
    fontSize: 12
  }
});
