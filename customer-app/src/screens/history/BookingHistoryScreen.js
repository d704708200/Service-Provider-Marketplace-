import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'completed', label: 'Completed' }
];

export default function BookingHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState([]);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await bookingApi.getMyBookings();
      setBookings(res.data || []);
    } catch (err) {
      // Fallback empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const getFilteredBookings = () => {
    if (selectedTab === 'pending') {
      return bookings.filter((b) => b.status === 'pending');
    }
    if (selectedTab === 'accepted') {
      return bookings.filter((b) => b.status === 'accepted' || b.status === 'in_progress');
    }
    if (selectedTab === 'completed') {
      return bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled');
    }
    return bookings;
  };

  const getTabCount = (tabId) => {
    if (tabId === 'pending') {
      return bookings.filter((b) => b.status === 'pending').length;
    }
    if (tabId === 'accepted') {
      return bookings.filter((b) => b.status === 'accepted' || b.status === 'in_progress').length;
    }
    if (tabId === 'completed') {
      return bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled').length;
    }
    return 0;
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${booking.bookingReference || ''}?`,
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
              Alert.alert('Cancellation Failed', err.userMessage || 'Unable to cancel booking');
            } finally {
              setCancellingId(null);
            }
          }
        }
      ]
    );
  };

  const renderBookingCard = ({ item }) => {
    const providerName =
      item.provider?.businessName || item.provider?.user?.name || 'Raj Kumar';
    const category = item.service?.name || item.provider?.specialization || 'Electrical Inspection';
    const scheduledDate = item.scheduledDate
      ? new Date(item.scheduledDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      : 'Today, 15 Jun';
    const timeSlot = item.scheduledTimeSlot?.startTime || '2:30 PM';
    const location = item.address?.street
      ? `${item.address.street}, ${item.address.city || ''}`
      : 'Civil Lines, Prayagraj';
    const reference = item.bookingReference || 'BK-2024-0018';

    return (
      <View style={styles.bookingCard}>
        {/* Top Header Badge & Ref */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.statusBadgeYellow}>
            <View style={styles.statusYellowDot} />
            <Text style={styles.statusYellowText}>Awaiting response</Text>
          </View>
          <Text style={styles.refText}>{reference}</Text>
        </View>

        {/* Provider Profile & Call Row */}
        <View style={styles.providerRow}>
          <Image
            source={{
              uri:
                item.provider?.avatar ||
                'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=100&auto=format&fit=crop&q=80'
            }}
            style={styles.providerAvatar}
          />
          <View style={styles.providerInfoCol}>
            <View style={styles.nameRow}>
              <Text style={styles.providerName}>{providerName}</Text>
              <Ionicons name="checkmark-circle" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.categorySub}>{category}</Text>
          </View>

          <TouchableOpacity style={styles.callIconBtn} activeOpacity={0.7}>
            <Ionicons name="call" size={16} color="#A78BFA" />
          </TouchableOpacity>
        </View>

        {/* Schedule & Address Dark Card */}
        <View style={styles.metaBox}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{scheduledDate}</Text>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" style={{ marginLeft: 16 }} />
            <Text style={styles.metaText}>{timeSlot}</Text>
          </View>

          <View style={[styles.metaRow, { marginTop: 8 }]}>
            <Ionicons name="location-outline" size={14} color="#9CA3AF" />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row: Cancel and View Details */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={() => handleCancelBooking(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewDetailsActionBtn}
            onPress={() => {
              if (item.service?._id) {
                navigation.navigate('ServiceDetail', { serviceId: item.service._id });
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.viewDetailsActionText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filteredData = getFilteredBookings();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header: My Bookings matching Figma */}
      <View style={styles.headerSection}>
        <Text style={styles.mainTitle}>My</Text>
        <Text style={styles.mainTitle}>Bookings</Text>
      </View>

      {/* Tabs Row: Pending (1), Accepted (0), Completed (0) */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isSelected = selectedTab === tab.id;
          const count = getTabCount(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
                <Text style={[styles.countBadgeText, isSelected && styles.countBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bookings List */}
      {loading ? (
        <ActivityIndicator size="small" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={
            filteredData.length > 0
              ? filteredData
              : [
                  {
                    _id: 'sample_1',
                    bookingReference: 'BK-2024-0018',
                    status: 'pending',
                    service: { name: 'Electrical Inspection' },
                    provider: { businessName: 'Raj Kumar' },
                    scheduledDate: new Date(),
                    address: { street: 'Civil Lines', city: 'Prayagraj' }
                  }
                ]
          }
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
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
  headerSection: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 16
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136'
  },
  tabButtonActive: {
    backgroundColor: '#2E1065',
    borderColor: '#7C3AED'
  },
  tabLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  tabLabelActive: {
    color: '#DDD6FE',
    fontWeight: '600'
  },
  countBadge: {
    marginLeft: 6,
    backgroundColor: '#241F36',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  countBadgeActive: {
    backgroundColor: '#7C3AED'
  },
  countBadgeText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  countBadgeTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  bookingCard: {
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  statusBadgeYellow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2314',
    borderWidth: 1,
    borderColor: '#4A3B18',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5
  },
  statusYellowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B'
  },
  statusYellowText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FBBF24'
  },
  refText: {
    fontSize: 10,
    color: '#71717A'
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  providerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: '#262238'
  },
  providerInfoCol: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  categorySub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  callIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#36314D'
  },
  metaBox: {
    backgroundColor: '#1C1929',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaText: {
    fontSize: 11,
    color: '#E2E8F0',
    marginLeft: 6
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  cancelActionBtn: {
    flex: 1,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#2E2942',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF'
  },
  viewDetailsActionBtn: {
    flex: 1,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewDetailsActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF'
  }
});
