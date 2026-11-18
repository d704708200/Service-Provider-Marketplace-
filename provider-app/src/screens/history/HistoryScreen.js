import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { bookingApi } from '../../services/api';
import { Header, Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import { spacing, typography, borderRadius } from '../../theme';

const STATUS_FILTERS = [
  { label: 'All Jobs', value: 'all' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
];

export default function HistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [bookings, setBookings] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }
      const res = await bookingApi.getHistory(params);
      setBookings(res.data || []);
    } catch (err) {
      setError(err.userMessage || 'Unable to load booking history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
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
      default:
        return { label: status.toUpperCase(), variant: 'slate' };
    }
  };

  const renderBookingCard = ({ item }) => {
    const badge = getStatusBadge(item.status);
    const scheduleText =
      item.bookingMode === 'instant'
        ? 'ASAP (Instant)'
        : item.scheduledDate
        ? `${new Date(item.scheduledDate).toLocaleDateString()} (${item.scheduledTimeSlot?.startTime || ''} - ${item.scheduledTimeSlot?.endTime || ''})`
        : 'N/A';

    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleCol}>
            <Text style={styles.reference}>{item.bookingReference}</Text>
            <Text style={styles.serviceName}>{item.service?.name || 'Service'}</Text>
          </View>
          <Badge label={badge.label} variant={badge.variant} size="sm" />
        </View>

        <View style={styles.row}>
          <Ionicons name="person-outline" size={15} color="#9CA3AF" />
          <Text style={styles.text}>{item.customer?.user?.name || 'Customer'}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={15} color="#9CA3AF" />
          <Text style={styles.text}>{scheduleText}</Text>
        </View>

        <View style={styles.row}>
          <Ionicons name="location-outline" size={15} color="#9CA3AF" />
          <Text style={styles.text} numberOfLines={1}>
            {item.address?.street}, {item.address?.city}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.price}>
            ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
          </Text>
          <View style={styles.viewRow}>
            <Text style={styles.viewText}>View Details</Text>
            <Ionicons name="chevron-forward" size={14} color="#A78BFA" />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Job History"
        subtitle="Claimed & Completed Bookings"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <View style={styles.filterSection}>
        <ScrollView showsVerticalScrollIndicator={false}
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

      {loading && !refreshing ? (
        <LoadingScreen message="Loading job history..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchHistory} />
      ) : (
        <FlatList showsHorizontalScrollIndicator={false}
          data={bookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#7C3AED']}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No Jobs Found"
              description={
                selectedStatus === 'all'
                  ? 'You have not claimed or completed any service bookings yet.'
                  : `You have no ${selectedStatus.replace('_', ' ')} service jobs.`
              }
            />
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  filterSection: {
    backgroundColor: colors.card,
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
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  filterTabTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm
  },
  reference: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 2
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.textPrimary
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  text: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  price: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  viewText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600'
  }
});
