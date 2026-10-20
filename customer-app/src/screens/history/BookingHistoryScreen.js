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
  ActivityIndicator,
  TextInput,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../services/api';
import { openRazorpayCheckout } from '../../services/razorpayService';

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
  const [fetchError, setFetchError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await bookingApi.getMyBookings();
      setBookings(res.data || []);
    } catch (err) {
      setFetchError(err.userMessage || err.message || 'Failed to load bookings');
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

  const isProposalPending = (b) => {
    return (
      b.spareParts &&
      b.spareParts.items?.length > 0 &&
      ['pending_approval', 'pending_customer_approval'].includes(b.spareParts.status)
    );
  };

  const pendingApprovalCount = bookings.filter(isProposalPending).length;

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

  const [reviewBooking, setReviewBooking] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [payingParts, setPayingParts] = useState(false);


  const handleApproveCharges = async (booking) => {
    setReviewSubmitting(true);
    try {
      const res = await bookingApi.reviewSpareParts(booking._id, { action: 'approve' });
      if (res?.success) {
        Alert.alert('Charges Approved', 'Spare parts and labour charges approved.');
        setReviewBooking(res.data);
        fetchBookings();
      }
    } catch (err) {
      Alert.alert('Approval Failed', err.userMessage || 'Could not approve charges');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRejectCharges = async (booking) => {
    if (!rejectReason.trim()) {
      Alert.alert('Rejection Reason Required', 'Please provide a brief reason for rejecting the charges.');
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await bookingApi.reviewSpareParts(booking._id, {
        action: 'reject',
        rejectionReason: rejectReason.trim()
      });
      if (res?.success) {
        Alert.alert('Charges Rejected', 'You rejected the additional charges. Booking remains active with original service price.');
        setReviewBooking(res.data);
        setShowRejectInput(false);
        setRejectReason('');
        fetchBookings();
      }
    } catch (err) {
      Alert.alert('Rejection Failed', err.userMessage || 'Could not reject charges');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handlePaySparePartsOnline = async (booking) => {
    setPayingParts(true);
    try {
      const orderRes = await bookingApi.createSparePartsPaymentOrder(booking._id);
      if (!orderRes?.success || !orderRes.data) {
        throw new Error(orderRes?.message || 'Failed to create spare parts payment order');
      }

      const checkoutResult = await openRazorpayCheckout({
        orderData: orderRes.data,
        description: `Spare Parts & Materials (${orderRes.data.bookingReference || ''})`,
        customerName: orderRes.data.customer?.name || 'Customer',
        customerPhone: orderRes.data.customer?.phone || '',
        themeColor: '#7C3AED'
      });

      if (checkoutResult.success && checkoutResult.data) {
        try {
          const verifyRes = await bookingApi.verifySparePartsPayment(booking._id, {
            razorpayOrderId: checkoutResult.data.razorpayOrderId,
            razorpayPaymentId: checkoutResult.data.razorpayPaymentId,
            razorpaySignature: checkoutResult.data.razorpaySignature
          });

          if (verifyRes?.success && verifyRes.data) {
            Alert.alert('Payment Successful', 'Spare parts payment has been completed and verified.');
            setReviewBooking(verifyRes.data);
            fetchBookings();
          } else {
            Alert.alert('Verification Issue', 'Payment was processed but verification failed. Please contact support.');
          }
        } catch (verErr) {
          try {
            await bookingApi.recordSparePartsPaymentFailure(
              booking._id,
              verErr.userMessage || verErr.message || 'Signature verification failed'
            );
          } catch (_) {}
          Alert.alert('Verification Error', verErr.userMessage || verErr.message || 'Payment verification failed. Outstanding balance retained. You can retry payment.');
          fetchBookings();
        }
      } else {
        const isCancelled = checkoutResult.error?.isCancelled;
        const msg = checkoutResult.error?.description || (isCancelled ? 'Payment cancelled' : 'Payment failed');
        try {
          await bookingApi.recordSparePartsPaymentFailure(booking._id, msg);
        } catch (_) {}
        if (!isCancelled) {
          Alert.alert('Payment Notice', `${msg}. Outstanding balance is retained. You can retry payment anytime.`);
        }
        fetchBookings();
      }
    } catch (err) {
      Alert.alert('Payment Initiation Failed', err.userMessage || err.message || 'Could not launch payment');
    } finally {
      setPayingParts(false);
    }
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

    const hasSpareParts = item.spareParts && item.spareParts.status !== 'none' && item.spareParts.items?.length > 0;
    const partsPending = item.spareParts?.status === 'pending_approval' || item.spareParts?.status === 'pending_customer_approval';
    const partsApproved = item.spareParts?.status === 'approved';
    const partsRejected = item.spareParts?.status === 'rejected';

    return (
      <View style={styles.bookingCard}>
        {/* Top Header Badge & Ref */}
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.statusBadgeYellow,
              item.status === 'completed'
                ? styles.statusBadgeGreen
                : item.status === 'in_progress'
                ? styles.statusBadgeBlue
                : item.status === 'cancelled'
                ? styles.statusBadgeRed
                : null
            ]}
          >
            <View
              style={[
                styles.statusYellowDot,
                item.status === 'completed'
                  ? styles.statusGreenDot
                  : item.status === 'in_progress'
                  ? styles.statusBlueDot
                  : item.status === 'cancelled'
                  ? styles.statusRedDot
                  : null
              ]}
            />
            <Text
              style={[
                styles.statusYellowText,
                item.status === 'completed'
                  ? styles.statusGreenText
                  : item.status === 'in_progress'
                  ? styles.statusBlueText
                  : item.status === 'cancelled'
                  ? styles.statusRedText
                  : null
              ]}
            >
              {item.status === 'pending'
                ? 'Awaiting response'
                : item.status === 'in_progress'
                ? 'In Progress'
                : item.status.toUpperCase()}
            </Text>
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

        {/* Price & Payment Summary */}
        <View style={styles.pricingSummaryRow}>
          <Text style={styles.pricingSummaryLabel}>
            Total: <Text style={styles.pricingSummaryAmount}>₹{item.pricing?.totalAmount || 0}</Text>
          </Text>
          <Text style={styles.paymentStatusText}>
            {item.paymentMethod?.toUpperCase() || 'CASH'} •{' '}
            <Text style={{ color: item.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' }}>
              {item.paymentStatus?.toUpperCase() || 'PENDING'}
            </Text>
          </Text>
        </View>

        {/* Spare Parts Review Banner */}
        {hasSpareParts && (
          <TouchableOpacity
            style={[
              styles.partsBannerBox,
              partsPending
                ? styles.partsBannerPending
                : partsApproved
                ? styles.partsBannerApproved
                : styles.partsBannerRejected
            ]}
            onPress={() => setReviewBooking(item)}
            activeOpacity={0.85}
          >
            <View style={styles.partsBannerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={partsPending ? 'construct' : partsApproved ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={partsPending ? '#F59E0B' : partsApproved ? '#10B981' : '#F43F5E'}
                />
                <Text style={styles.partsBannerTitle}>
                  Spare Parts Bill (+₹{item.spareParts.totalAdditionalAmount})
                </Text>
              </View>
              <Text
                style={[
                  styles.partsBannerActionText,
                  partsPending
                    ? { color: '#F59E0B' }
                    : partsApproved
                    ? { color: '#10B981' }
                    : { color: '#F43F5E' }
                ]}
              >
                {partsPending ? 'Review & Approve' : partsApproved ? 'Approved' : 'Rejected'} →
              </Text>
            </View>
            <Text style={styles.partsBannerDesc} numberOfLines={1}>
              {item.spareParts.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
            </Text>
          </TouchableOpacity>
        )}

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

        {/* Action Buttons Row: Cancel, Spare Parts Review & View Details */}
        <View style={styles.actionButtonsRow}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={styles.cancelActionBtn}
              onPress={() => handleCancelBooking(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {hasSpareParts && (
            <TouchableOpacity
              style={styles.reviewPartsActionBtn}
              onPress={() => setReviewBooking(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={14} color="#A78BFA" />
              <Text style={styles.reviewPartsActionText}>Spare Parts</Text>
            </TouchableOpacity>
          )}

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

      {/* Alert Banner if any booking requires spare parts approval */}
      {pendingApprovalCount > 0 && (
        <TouchableOpacity
          style={styles.pendingApprovalTopBanner}
          onPress={() => {
            setSelectedTab('accepted');
            const pendingBooking = bookings.find(isProposalPending);
            if (pendingBooking) {
              setReviewBooking(pendingBooking);
            }
          }}
          activeOpacity={0.85}
        >
          <View style={styles.pendingApprovalIconBox}>
            <Ionicons name="alert-circle" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingApprovalTitle}>
              {pendingApprovalCount === 1
                ? 'Action Required: Extra Items Proposed'
                : `${pendingApprovalCount} Bookings Require Extra Items Approval`}
            </Text>
            <Text style={styles.pendingApprovalSub}>
              Review the itemized bill and approve or reject before service completion.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* Tabs Row: Pending (1), Accepted (0), Completed (0) */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isSelected = selectedTab === tab.id;
          const count = getTabCount(tab.id);
          const hasPendingExtraInTab =
            tab.id === 'accepted' && pendingApprovalCount > 0;

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
              <View
                style={[
                  styles.countBadge,
                  isSelected && styles.countBadgeActive,
                  hasPendingExtraInTab && styles.countBadgeHighlight
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    isSelected && styles.countBadgeTextActive,
                    hasPendingExtraInTab && styles.countBadgeTextHighlight
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error state */}
      {fetchError && !loading && (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={32} color="#F43F5E" />
          <Text style={styles.errorTitle}>Could Not Load Bookings</Text>
          <Text style={styles.errorDesc}>{fetchError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchBookings}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bookings List */}
      {loading ? (
        <ActivityIndicator size="small" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : !fetchError && (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={40} color="#4B5563" />
              <Text style={styles.emptyTitle}>
                {selectedTab === 'pending'
                  ? 'No Pending Requests'
                  : selectedTab === 'accepted'
                  ? 'No Active Bookings'
                  : 'No Completed Bookings'}
              </Text>
              <Text style={styles.emptyDesc}>
                {selectedTab === 'pending'
                  ? 'You do not have any booking requests waiting for provider acceptance.'
                  : selectedTab === 'accepted'
                  ? 'Bookings accepted or in progress will appear here.'
                  : 'Your service history will be saved here once jobs are completed.'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
          }
        />
      )}

      {/* Spare Parts Review Modal for Customer */}
      {reviewBooking && reviewBooking.spareParts && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Spare Parts & Materials Bill</Text>
                <Text style={styles.modalSubtitle}>
                  Booking Ref: {reviewBooking.bookingReference}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setReviewBooking(null);
                  setShowRejectInput(false);
                  setRejectReason('');
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Status Notice */}
              <View
                style={[
                  styles.statusAlertBox,
                  reviewBooking.spareParts.status === 'approved'
                    ? styles.statusAlertApproved
                    : reviewBooking.spareParts.status === 'rejected'
                    ? styles.statusAlertRejected
                    : styles.statusAlertPending
                ]}
              >
                <Ionicons
                  name={
                    reviewBooking.spareParts.status === 'approved'
                      ? 'checkmark-circle'
                      : reviewBooking.spareParts.status === 'rejected'
                      ? 'close-circle'
                      : 'alert-circle'
                  }
                  size={18}
                  color={
                    reviewBooking.spareParts.status === 'approved'
                      ? '#10B981'
                      : reviewBooking.spareParts.status === 'rejected'
                      ? '#F43F5E'
                      : '#F59E0B'
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusAlertTitle}>
                    {reviewBooking.spareParts.status === 'approved'
                      ? 'Charges Approved'
                      : reviewBooking.spareParts.status === 'rejected'
                      ? 'Charges Rejected'
                      : 'Provider Proposed Additional Charges'}
                  </Text>
                  <Text style={styles.statusAlertDesc}>
                    {reviewBooking.spareParts.status === 'approved'
                      ? `Approved by you. Additional amount added to total bill.`
                      : reviewBooking.spareParts.status === 'rejected'
                      ? `Reason: ${reviewBooking.spareParts.rejectionReason || 'Declined by customer'}`
                      : 'Please verify the parts list and labour below. Your booking total will only update upon approval.'}
                  </Text>
                </View>
              </View>

              {/* Items Breakdown Table */}
              <Text style={styles.sectionHeaderTitle}>Parts & Materials Breakdown</Text>
              <View style={styles.itemsTableCard}>
                {reviewBooking.spareParts.items.map((part, index) => (
                  <View key={index} style={styles.tableRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.tableItemName}>{part.name}</Text>
                      {part.description ? (
                        <Text style={styles.tableItemDesc}>{part.description}</Text>
                      ) : null}
                      <Text style={styles.tableItemCalc}>
                        Qty: {part.quantity} × ₹{part.unitPrice}
                        {part.labourCharge > 0 ? ` + Labour: ₹${part.labourCharge}` : ''}
                      </Text>
                      {part.notes ? (
                        <Text style={styles.tableItemNotes}>Note: {part.notes}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.tableItemTotal}>₹{part.totalPrice}</Text>
                  </View>
                ))}
              </View>

              {/* Pricing Breakdown Summary */}
              <View style={styles.costSummaryCard}>
                <View style={styles.costSummaryRow}>
                  <Text style={styles.costSummaryLabel}>Original Base Service:</Text>
                  <Text style={styles.costSummaryVal}>
                    ₹{reviewBooking.spareParts.originalServiceAmount || reviewBooking.pricing?.basePrice || 0}
                  </Text>
                </View>
                <View style={styles.costSummaryRow}>
                  <Text style={styles.costSummaryLabel}>Parts Subtotal:</Text>
                  <Text style={styles.costSummaryVal}>
                    ₹{reviewBooking.spareParts.partsSubtotal || 0}
                  </Text>
                </View>
                <View style={styles.costSummaryRow}>
                  <Text style={styles.costSummaryLabel}>Labour Subtotal:</Text>
                  <Text style={styles.costSummaryVal}>
                    ₹{reviewBooking.spareParts.labourSubtotal || 0}
                  </Text>
                </View>
                <View style={styles.costDivider} />
                <View style={styles.costSummaryRow}>
                  <Text style={styles.costTotalAdditionalLabel}>Additional Amount:</Text>
                  <Text style={styles.costTotalAdditionalVal}>
                    +₹{reviewBooking.spareParts.totalAdditionalAmount || 0}
                  </Text>
                </View>
                <View style={styles.costSummaryRow}>
                  <Text style={styles.costFinalPayableLabel}>Revised Final Payable:</Text>
                  <Text style={styles.costFinalPayableVal}>
                    ₹{reviewBooking.pricing?.totalAmount || 0}
                  </Text>
                </View>
              </View>

              {/* Rejection Form Input */}
              {showRejectInput &&
                ['pending_approval', 'pending_customer_approval'].includes(reviewBooking.spareParts.status) && (
                <View style={styles.rejectionInputCard}>
                  <Text style={styles.rejectionInputLabel}>Reason for Rejection *</Text>
                  <TextInput
                    style={styles.rejectionTextInput}
                    placeholder="e.g. Price too high, parts already arranged, service not needed"
                    placeholderTextColor="#6B7280"
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    multiline
                  />
                  <View style={styles.rejectionActionRow}>
                    <TouchableOpacity
                      style={styles.cancelRejectBtn}
                      onPress={() => setShowRejectInput(false)}
                    >
                      <Text style={styles.cancelRejectText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmRejectBtn}
                      onPress={() => handleRejectCharges(reviewBooking)}
                      disabled={reviewSubmitting}
                    >
                      <Text style={styles.confirmRejectText}>
                        {reviewSubmitting ? 'Submitting...' : 'Confirm Rejection'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Online Payment for Approved Parts */}
              {reviewBooking.spareParts.status === 'approved' &&
                reviewBooking.spareParts.paymentStatus !== 'paid' &&
                reviewBooking.paymentMethod === 'online' && (
                  <View style={styles.onlinePayBox}>
                    <Text style={styles.onlinePayTitle}>Pay Additional Charges Online</Text>
                    <Text style={styles.onlinePaySub}>
                      Pay ₹{reviewBooking.spareParts.totalAdditionalAmount} securely via Razorpay
                    </Text>
                    <TouchableOpacity
                      style={styles.payPartsOnlineBtn}
                      onPress={() => handlePaySparePartsOnline(reviewBooking)}
                      disabled={payingParts}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.payPartsOnlineBtnText}>
                        {payingParts ? 'Processing...' : `Pay ₹${reviewBooking.spareParts.totalAdditionalAmount} with Razorpay`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              {/* Cash Payment Information for Approved Parts */}
              {reviewBooking.spareParts.status === 'approved' && reviewBooking.paymentMethod === 'cash' && (
                <View style={[styles.onlinePayBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <Text style={[styles.onlinePayTitle, { color: '#10B981' }]}>Cash on Service Payment</Text>
                  <Text style={styles.onlinePaySub}>
                    Total Cash Payable on Completion: ₹{reviewBooking.pricing?.totalAmount || 0}
                    {reviewBooking.paymentDetails?.cashConfirmedByProvider
                      ? ' (Provider marked cash received)'
                      : ' (Pay directly to provider)'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Actions */}
            {['pending_approval', 'pending_customer_approval'].includes(reviewBooking.spareParts.status) && !showRejectInput && (
              <View style={styles.modalActionFooter}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => setShowRejectInput(true)}
                  disabled={reviewSubmitting}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#F43F5E" />
                  <Text style={styles.rejectBtnText}>Reject Charges</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => handleApproveCharges(reviewBooking)}
                  disabled={reviewSubmitting}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>
                    {reviewSubmitting ? 'Processing...' : 'Approve Charges'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
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
  },
  reviewPartsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#201A36',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  reviewPartsActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA'
  },
  pricingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1F1B2D',
    marginBottom: 8
  },
  pricingSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  pricingSummaryAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF'
  },
  statusBadgeGreen: {
    backgroundColor: '#052E16',
    borderColor: '#15803D'
  },
  statusGreenDot: {
    backgroundColor: '#22C55E'
  },
  statusGreenText: {
    color: '#86EFAC'
  },
  statusBadgeBlue: {
    backgroundColor: '#1E1B4B',
    borderColor: '#4338CA'
  },
  statusBlueDot: {
    backgroundColor: '#6366F1'
  },
  statusBlueText: {
    color: '#A5B4FC'
  },
  statusBadgeRed: {
    backgroundColor: '#450A0A',
    borderColor: '#B91C1C'
  },
  statusRedDot: {
    backgroundColor: '#EF4444'
  },
  statusRedText: {
    color: '#FCA5A5'
  },
  partsBannerBox: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1
  },
  partsBannerPending: {
    backgroundColor: '#2A1B0A',
    borderColor: '#B45309'
  },
  partsBannerApproved: {
    backgroundColor: '#062E1F',
    borderColor: '#059669'
  },
  partsBannerRejected: {
    backgroundColor: '#311018',
    borderColor: '#BE123C'
  },
  partsBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  partsBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  partsBannerActionText: {
    fontSize: 11,
    fontWeight: '700'
  },
  partsBannerDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999
  },
  modalContainer: {
    backgroundColor: '#161420',
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A253E',
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#252136'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  modalBody: {
    padding: 16
  },
  statusAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1
  },
  statusAlertPending: {
    backgroundColor: '#261806',
    borderColor: '#D97706'
  },
  statusAlertApproved: {
    backgroundColor: '#04271B',
    borderColor: '#059669'
  },
  statusAlertRejected: {
    backgroundColor: '#2D0A14',
    borderColor: '#E11D48'
  },
  statusAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  statusAlertDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 3
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8
  },
  itemsTableCard: {
    backgroundColor: '#1C1929',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D2845',
    padding: 12,
    marginBottom: 16
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262238'
  },
  tableItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  tableItemDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  tableItemCalc: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 2
  },
  tableItemNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6B7280',
    marginTop: 2
  },
  tableItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  costSummaryCard: {
    backgroundColor: '#12101C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26213B',
    padding: 14,
    marginBottom: 16
  },
  costSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  costSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  costSummaryVal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E5E7EB'
  },
  costDivider: {
    height: 1,
    backgroundColor: '#26213B',
    marginVertical: 6
  },
  costTotalAdditionalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B'
  },
  costTotalAdditionalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F59E0B'
  },
  costFinalPayableLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  costFinalPayableVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#34D399'
  },
  rejectionInputCard: {
    backgroundColor: '#23121C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#601F31',
    padding: 12,
    marginBottom: 16
  },
  rejectionInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FDA4AF',
    marginBottom: 6
  },
  rejectionTextInput: {
    backgroundColor: '#0F0E16',
    borderWidth: 1,
    borderColor: '#4C1D2A',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  rejectionActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10
  },
  cancelRejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#2E2942'
  },
  cancelRejectText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  confirmRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E11D48'
  },
  confirmRejectText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  onlinePayBox: {
    backgroundColor: '#1E1238',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4C1D95',
    padding: 14,
    marginBottom: 16,
    alignItems: 'center'
  },
  onlinePayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  onlinePaySub: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 2,
    marginBottom: 10
  },
  payPartsOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%'
  },
  payPartsOnlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalActionFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#252136',
    gap: 12
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2E101D',
    borderWidth: 1,
    borderColor: '#7F1D1D'
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F43F5E'
  },
  approveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#059669'
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  pendingApprovalTopBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#291807',
    borderWidth: 1,
    borderColor: '#B45309',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    gap: 10
  },
  pendingApprovalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pendingApprovalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24'
  },
  pendingApprovalSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2
  },
  countBadgeHighlight: {
    backgroundColor: '#D97706'
  },
  countBadgeTextHighlight: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 20
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12
  },
  errorDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 20
  },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 12
  },
  emptyDesc: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 24,
    lineHeight: 18
  }
});
