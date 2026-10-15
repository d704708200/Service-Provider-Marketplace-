import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';

export default function RequestsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const res = await bookingApi.getPendingRequests();
      setRequests(res.data || []);
    } catch (err) {
      setError(err.userMessage || 'Unable to load pending requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleAccept = async (booking) => {
    setProcessingId(booking._id);
    try {
      const res = await bookingApi.acceptBooking(booking._id);
      if (res?.success) {
        Alert.alert(
          'Request Accepted!',
          `You have successfully claimed booking ${booking.bookingReference}.`,
          [
            {
              text: 'View Booking',
              onPress: () =>
                navigation.navigate('BookingDetail', { bookingId: booking._id })
            },
            { text: 'OK', onPress: () => fetchRequests() }
          ]
        );
      }
    } catch (err) {
      Alert.alert(
        'Could Not Accept Request',
        err.userMessage || 'This booking may have already been accepted by another provider.'
      );
      fetchRequests();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (booking) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline booking ${booking.bookingReference}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(booking._id);
            try {
              await bookingApi.rejectBooking(booking._id, 'Provider declined');
              fetchRequests();
            } catch (err) {
              Alert.alert('Error', err.userMessage || 'Failed to reject request');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const renderRequestCard = ({ item }) => {
    const isInstant = item.bookingMode === 'instant';
    const scheduleText = isInstant
      ? 'ASAP (Instant)'
      : item.scheduledDate
      ? `${new Date(item.scheduledDate).toLocaleDateString()} (${item.scheduledTimeSlot?.startTime || ''} - ${item.scheduledTimeSlot?.endTime || ''})`
      : 'Scheduled';

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
          <Badge
            label={isInstant ? 'INSTANT' : 'SCHEDULED'}
            variant={isInstant ? 'warning' : 'primary'}
            size="sm"
          />
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

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText} numberOfLines={2}>
              "{item.notes}"
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.price}>
            ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
          </Text>

          <View style={styles.actionBtns}>
            <Button
              title="Decline"
              variant="outline"
              size="sm"
              disabled={processingId === item._id}
              onPress={() => handleReject(item)}
              style={styles.rejectBtn}
              textStyle={styles.rejectBtnText}
            />
            <Button
              title={processingId === item._id ? 'Accepting...' : 'Accept Request'}
              variant="primary"
              size="sm"
              loading={processingId === item._id}
              disabled={processingId === item._id}
              onPress={() => handleAccept(item)}
              style={styles.acceptBtn}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Incoming Requests"
        subtitle="Broadcasts & Dispatch Pipeline"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      {loading && !refreshing ? (
        <LoadingScreen message="Checking for incoming requests..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchRequests} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderRequestCard}
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
              icon="notifications-off-outline"
              title="No Pending Requests"
              description="You have no pending booking requests right now. New customer bookings in your active coverage zones will appear here automatically."
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
    backgroundColor: '#0B0B0E'
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    backgroundColor: '#161420',
    borderColor: '#252136',
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
    color: '#A78BFA',
    fontWeight: '700',
    marginBottom: 2
  },
  serviceName: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  text: {
    ...typography.bodySmall,
    color: '#CBD5E1',
    flex: 1
  },
  notesBox: {
    backgroundColor: '#1C1929',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A253E',
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  notesText: {
    ...typography.caption,
    color: '#9CA3AF',
    fontStyle: 'italic'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252136',
    paddingTop: spacing.sm,
    marginTop: spacing.xs
  },
  price: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  actionBtns: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  rejectBtn: {
    borderColor: '#36314D',
    paddingHorizontal: spacing.md
  },
  rejectBtnText: {
    color: '#9CA3AF',
    fontSize: 12
  },
  acceptBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: spacing.md
  }
});
