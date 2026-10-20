import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { bookingApi, providerApi } from '../../services/api';
import { Card, Badge, Button } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile: authProfile, checkAuthSession } = useAuth();

  const [profile, setProfile] = useState(authProfile);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [profileRes, pendingRes, acceptedRes, inProgressRes, completedRes, notifsRes] = await Promise.all([
        providerApi.getProfile().catch(() => ({ data: null })),
        bookingApi.getPendingRequests().catch(() => ({ data: [] })),
        bookingApi.getHistory({ status: 'accepted' }).catch(() => ({ data: [] })),
        bookingApi.getHistory({ status: 'in_progress' }).catch(() => ({ data: [] })),
        bookingApi.getHistory({ status: 'completed' }).catch(() => ({ data: [] })),
        bookingApi.getNotifications({ unreadOnly: 'true' }).catch(() => ({ data: [], unreadCount: 0 }))
      ]);

      if (profileRes?.data) {
        setProfile(profileRes.data);
        setIsAvailable(Boolean(profileRes.data.isAvailable));
      }

      const pendingList = pendingRes?.data || [];
      const unreadNotifCount = typeof notifsRes?.unreadCount === 'number' ? notifsRes.unreadCount : 0;
      setPendingRequests(pendingList);
      setUnreadNotificationsCount(Math.max(pendingList.length, unreadNotifCount));
      const active = [...(acceptedRes?.data || []), ...(inProgressRes?.data || [])];
      setActiveBookings(active);
      setCompletedBookings(completedRes?.data || []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleToggleAvailability = async (value) => {
    setIsAvailable(value);
    setToggleLoading(true);
    try {
      const res = await providerApi.updateProfile({ isAvailable: value });
      if (res?.success && res.data) {
        setProfile(res.data);
        setIsAvailable(Boolean(res.data.isAvailable));
      }
      await checkAuthSession();
    } catch (err) {
      // Revert if error
      setIsAvailable(!value);
    } finally {
      setToggleLoading(false);
    }
  };

  const verificationStatus = profile?.verificationStatus || 'pending';
  const providerDisplayName = profile?.businessName || user?.name || 'Service Partner';

  return (
    <View style={styles.container}>
      {/* Top Header Row matching Customer App styling */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.providerAvatarCircle}>
            <Ionicons name="business" size={20} color="#A78BFA" />
          </View>
          <View style={styles.userTextCol}>
            <Text style={styles.greetingText}>Hello, {providerDisplayName.split(' ')[0]}</Text>
            <View style={styles.statusIndicatorRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isAvailable ? '#10B981' : '#6B7280' }
                ]}
              />
              <Text style={styles.statusLabelText}>
                {isAvailable ? 'Online & Available' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('RequestsTab')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
            {unreadNotificationsCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Availability & Verification Banner */}
        <View style={styles.availabilityBanner}>
          <View style={styles.availabilityInfo}>
            <View style={styles.bannerBadgeRow}>
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
              />
              <Text style={styles.dutyLabel}>
                {isAvailable ? 'RECEIVING REQUESTS' : 'PAUSED'}
              </Text>
            </View>
            <Text style={styles.bannerTitle}>
              {isAvailable ? 'You are currently Online' : 'You are currently Offline'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {isAvailable
                ? 'Nearby customers can book your active services in real time'
                : 'Turn your status online to accept incoming customer requests'}
            </Text>
          </View>
          <View style={styles.switchWrapper}>
            {toggleLoading ? (
              <ActivityIndicator size="small" color="#A78BFA" />
            ) : (
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: '#27272A', true: '#7C3AED' }}
                thumbColor={isAvailable ? '#FFFFFF' : '#A1A1AA'}
              />
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => navigation.navigate('RequestsTab')}
              activeOpacity={0.7}
            >
              <View style={styles.statIconBadge}>
                <Ionicons name="flash-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.statNumber}>{pendingRequests.length}</Text>
              <Text style={styles.statLabel}>Pending Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => navigation.navigate('HistoryTab')}
              activeOpacity={0.7}
            >
              <View style={styles.statIconBadge}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.statNumber}>{activeBookings.length}</Text>
              <Text style={styles.statLabel}>Active Bookings</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => navigation.navigate('HistoryTab')}
              activeOpacity={0.7}
            >
              <View style={styles.statIconBadge}>
                <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.statNumber}>
                {profile?.completedBookingsCount || completedBookings.length}
              </Text>
              <Text style={styles.statLabel}>Completed Jobs</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <View style={styles.statIconBadge}>
                <Ionicons name="star" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.statNumber}>
                {profile?.rating?.average ? Number(profile.rating.average).toFixed(1) : '5.0'}
              </Text>
              <Text style={styles.statLabel}>Client Rating</Text>
            </View>
          </View>
        </View>

        {/* Quick Management Shortcuts */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Provider Quick Actions</Text>
          </View>

          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('RequestsTab')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="notifications-outline" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.quickActionTitle}>Incoming</Text>
              <Text style={styles.quickActionSub}>Review requests</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('HistoryTab')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="calendar-outline" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.quickActionTitle}>Bookings</Text>
              <Text style={styles.quickActionSub}>Track active jobs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ServicesTab')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="pricetag-outline" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.quickActionTitle}>Services</Text>
              <Text style={styles.quickActionSub}>Rates & catalog</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('Availability')}
              activeOpacity={0.7}
            >
              <View style={styles.quickIconCircle}>
                <Ionicons name="time-outline" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.quickActionTitle}>Schedule</Text>
              <Text style={styles.quickActionSub}>Working hours</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Urgent Pending Requests Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Incoming Broadcasts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('RequestsTab')}>
              <Text style={styles.seeAllText}>View all ({pendingRequests.length})</Text>
            </TouchableOpacity>
          </View>

          {pendingRequests.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="radio-outline" size={32} color="#71717A" />
              <Text style={styles.emptyCardTitle}>No Pending Broadcasts</Text>
              <Text style={styles.emptyCardSub}>
                New customer service requests in your area will appear here immediately.
              </Text>
            </Card>
          ) : (
            pendingRequests.slice(0, 3).map((item) => (
              <Card
                key={item._id}
                style={styles.broadcastCard}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.broadcastRef}>{item.bookingReference}</Text>
                    <Text style={styles.broadcastService}>
                      {item.service?.name || 'Service Request'}
                    </Text>
                  </View>
                  <Badge
                    label={item.bookingMode === 'instant' ? 'INSTANT' : 'SCHEDULED'}
                    variant={item.bookingMode === 'instant' ? 'warning' : 'primary'}
                    size="sm"
                  />
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.metaText}>{item.customer?.user?.name || 'Customer'}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.address?.city} {item.address?.zipCode ? `• ${item.address.zipCode}` : ''}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>
                    ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
                  </Text>
                  <View style={styles.viewLink}>
                    <Text style={styles.viewLinkText}>Review Request</Text>
                    <Ionicons name="arrow-forward" size={13} color="#A78BFA" />
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Active Jobs in Progress */}
        {activeBookings.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Active Scheduled Jobs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('HistoryTab')}>
                <Text style={styles.seeAllText}>See all ({activeBookings.length})</Text>
              </TouchableOpacity>
            </View>

            {activeBookings.slice(0, 2).map((item) => (
              <Card
                key={item._id}
                style={styles.activeJobCard}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
              >
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.broadcastRef}>{item.bookingReference}</Text>
                    <Text style={styles.broadcastService}>{item.service?.name}</Text>
                  </View>
                  <Badge
                    label={item.status === 'in_progress' ? 'IN PROGRESS' : 'ACCEPTED'}
                    variant={item.status === 'in_progress' ? 'primary' : 'secondary'}
                    size="sm"
                  />
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardPrice}>
                    ₹{item.pricing?.totalAmount?.toLocaleString('en-IN') || 0}
                  </Text>
                  <View style={styles.viewLink}>
                    <Text style={styles.viewLinkText}>Open Job Dashboard</Text>
                    <Ionicons name="chevron-forward" size={13} color="#A78BFA" />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0B0B0E',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1C2B'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  providerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1B2E',
    borderWidth: 1.5,
    borderColor: '#36314D',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userTextCol: {
    flex: 1
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusLabelText: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  availabilityBanner: {
    backgroundColor: '#161420',
    borderRadius: 18,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#252136',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  availabilityInfo: {
    flex: 1,
    marginRight: 12
  },
  bannerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  dutyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 0.5
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16
  },
  switchWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  statsSection: {
    marginVertical: 4,
    gap: 10
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    flex: 1,
    backgroundColor: '#161420',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252136'
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1F1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  sectionContainer: {
    marginTop: 18
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  seeAllText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600'
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#161420',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#252136',
    alignItems: 'center'
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#201A36',
    borderWidth: 1,
    borderColor: '#362E52',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2
  },
  quickActionSub: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  emptyCard: {
    backgroundColor: '#161420',
    borderColor: '#252136',
    alignItems: 'center',
    padding: 24,
    borderRadius: 16
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4
  },
  emptyCardSub: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  broadcastCard: {
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10
  },
  activeJobCard: {
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  broadcastRef: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    marginBottom: 2
  },
  broadcastService: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  metaText: {
    fontSize: 12,
    color: '#CBD5E1'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252136',
    paddingTop: 8,
    marginTop: 8
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  viewLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A78BFA'
  }
});
