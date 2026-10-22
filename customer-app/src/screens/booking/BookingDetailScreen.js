import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi, reviewApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

// Formatters
const formatScheduledDate = (rawDate) => {
  if (!rawDate) return 'Date not specified';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatTimestamp = (rawDate) => {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatAddress = (addr) => {
  if (!addr) return 'Address not provided';
  if (typeof addr === 'string') return addr;
  const parts = [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Address on file';
};

const getPaymentMethodDisplay = (method) => {
  const m = String(method || '').toLowerCase();
  if (m === 'cash') return { label: 'Cash on Service', icon: 'cash-outline' };
  if (m === 'online') return { label: 'Online Payment (Razorpay)', icon: 'card-outline' };
  if (m === 'upi') return { label: 'UPI Payment', icon: 'phone-portrait-outline' };
  return { label: (method || 'Cash').toUpperCase(), icon: 'wallet-outline' };
};

const getPaymentStatusBadge = (status) => {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'paid':
      return { label: 'PAID', variant: 'success' };
    case 'failed':
      return { label: 'FAILED', variant: 'danger' };
    case 'refunded':
      return { label: 'REFUNDED', variant: 'secondary' };
    case 'pending':
    default:
      return { label: (s || 'PENDING').toUpperCase(), variant: 'warning' };
  }
};

const getBookingStatusBadge = (status) => {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'confirmed':
    case 'completed':
      return { label: s.toUpperCase(), variant: 'success' };
    case 'in_progress':
      return { label: 'IN PROGRESS', variant: 'secondary' };
    case 'accepted':
      return { label: 'ACCEPTED', variant: 'primary' };
    case 'cancelled':
    case 'rejected':
      return { label: s.toUpperCase(), variant: 'danger' };
    case 'pending':
    default:
      return { label: (s || 'PENDING').toUpperCase(), variant: 'warning' };
  }
};

export default function BookingDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId, booking: initialBooking } = route.params || {};

  const [booking, setBooking] = useState(initialBooking || null);
  const [loading, setLoading] = useState(!initialBooking);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Review states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Spare parts review states
  const [partsSubmitting, setPartsSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const fetchDetail = useCallback(async () => {
    const id = bookingId || booking?._id;
    if (!id) return;
    try {
      setError(null);
      const res = await bookingApi.getBookingById(id);
      if (res?.data) {
        setBooking(res.data);
      }
    } catch (err) {
      if (!booking) {
        setError(err.userMessage || err.message || 'Unable to load booking details');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, booking?._id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetail();
  };

  const handleCopyReference = () => {
    const ref = booking?.bookingReference;
    if (!ref) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(ref).catch(() => {});
    }
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleCallProvider = (phone) => {
    if (!phone) {
      Alert.alert('Contact Unavailable', 'Provider phone number is not listed.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Failed', `Could not initiate call to ${phone}`);
    });
  };

  const handleCancelBooking = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking request? This action cannot be undone.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const res = await bookingApi.cancelBooking(booking._id, 'Customer cancelled from booking details');
              if (res?.success) {
                Alert.alert('Booking Cancelled', 'Your booking has been cancelled successfully.');
                fetchDetail();
              }
            } catch (err) {
              Alert.alert('Cancellation Failed', err.userMessage || 'Could not cancel booking');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  const handleApproveSpareParts = async () => {
    setPartsSubmitting(true);
    try {
      const res = await bookingApi.reviewSpareParts(booking._id, { action: 'approve' });
      if (res?.success) {
        Alert.alert('Charges Approved', 'Additional materials approved successfully.');
        fetchDetail();
      }
    } catch (err) {
      Alert.alert('Approval Failed', err.userMessage || 'Could not approve charges');
    } finally {
      setPartsSubmitting(false);
    }
  };

  const handleRejectSpareParts = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a brief reason for rejecting the charges.');
      return;
    }
    setPartsSubmitting(true);
    try {
      const res = await bookingApi.reviewSpareParts(booking._id, {
        action: 'reject',
        rejectionReason: rejectReason.trim()
      });
      if (res?.success) {
        Alert.alert('Charges Declined', 'Additional charges declined. Booking remains active at original base price.');
        setShowRejectInput(false);
        setRejectReason('');
        fetchDetail();
      }
    } catch (err) {
      Alert.alert('Rejection Failed', err.userMessage || 'Could not reject charges');
    } finally {
      setPartsSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (selectedRating < 1 || selectedRating > 5) {
      setReviewError('Please select a star rating between 1 and 5');
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await reviewApi.submitReview({
        bookingId: booking._id,
        rating: selectedRating,
        comment: reviewComment.trim()
      });
      if (res?.success) {
        Alert.alert('Review Submitted', 'Thank you for your rating and feedback!');
        setShowReviewModal(false);
        setReviewComment('');
        fetchDetail();
      }
    } catch (err) {
      setReviewError(err.userMessage || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading && !booking) {
    return <LoadingScreen message="Loading booking details..." />;
  }

  if (error && !booking) {
    return (
      <View style={styles.container}>
        <Header title="Booking Details" showBack onBack={() => navigation.goBack()} />
        <ErrorView message={error} onRetry={fetchDetail} />
      </View>
    );
  }

  const statusBadge = getBookingStatusBadge(booking.status);
  const paymentBadge = getPaymentStatusBadge(booking.paymentStatus);
  const paymentMethodInfo = getPaymentMethodDisplay(booking.paymentMethod);
  const provider = booking.provider;
  const providerUser = provider?.user;
  const providerName = provider?.businessName || providerUser?.name || 'Assigned Provider';
  const providerPhone = providerUser?.phone;
  const isInstant = booking.bookingMode === 'instant';
  const hasSpareParts = Boolean(
    booking.spareParts &&
    Array.isArray(booking.spareParts.items) &&
    booking.spareParts.items.length > 0
  );
  const partsPending = Boolean(
    booking.spareParts &&
    ['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)
  );

  return (
    <View style={styles.container}>
      <Header
        title="Booking Details"
        subtitle={booking.bookingReference}
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A78BFA"
            colors={['#7C3AED']}
          />
        }
      >
        {/* Reference & Status Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.refBadge}>
              <Ionicons name="receipt-outline" size={14} color="#A78BFA" />
              <Text style={styles.refText}>{booking.bookingReference}</Text>
            </View>
            <Badge label={statusBadge.label} variant={statusBadge.variant} size="md" />
          </View>

          <View style={styles.heroMetaRow}>
            <View style={styles.modeBadge}>
              <Ionicons
                name={isInstant ? 'flash' : 'calendar'}
                size={12}
                color={isInstant ? '#F59E0B' : '#A78BFA'}
              />
              <Text style={styles.modeText}>
                {isInstant ? 'Instant Service' : 'Scheduled Service'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.copyBtn}
              onPress={handleCopyReference}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedRef ? 'checkmark-outline' : 'copy-outline'}
                size={13}
                color={copiedRef ? '#34D399' : '#A78BFA'}
              />
              <Text style={[styles.copyBtnText, copiedRef && styles.copyBtnTextActive]}>
                {copiedRef ? 'Copied' : 'Copy Ref'}
              </Text>
            </TouchableOpacity>
          </View>

          {booking.createdAt && (
            <Text style={styles.bookedOnText}>
              Placed on {formatTimestamp(booking.createdAt)}
            </Text>
          )}
        </Card>

        {/* Action Alert Banner for Spare Parts Approval */}
        {partsPending && (
          <View style={styles.partsAlertBox}>
            <View style={styles.partsAlertHeader}>
              <Ionicons name="construct" size={18} color="#F59E0B" />
              <Text style={styles.partsAlertTitle}>
                Spare Parts Proposal (+₹{booking.spareParts.totalAdditionalAmount})
              </Text>
            </View>
            <Text style={styles.partsAlertDesc}>
              The provider requested approval for additional materials used for your service. Please review and confirm below.
            </Text>

            {showRejectInput ? (
              <View style={styles.rejectInputWrap}>
                <TextInput
                  style={styles.rejectInput}
                  placeholder="Reason for declining additional charges..."
                  placeholderTextColor="#6B7280"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  multiline
                />
                <View style={styles.rejectActionsRow}>
                  <TouchableOpacity
                    style={styles.cancelRejectBtn}
                    onPress={() => setShowRejectInput(false)}
                  >
                    <Text style={styles.cancelRejectText}>Back</Text>
                  </TouchableOpacity>
                  <Button
                    title="Confirm Decline"
                    variant="danger"
                    size="sm"
                    loading={partsSubmitting}
                    onPress={handleRejectSpareParts}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.partsAlertBtnRow}>
                <TouchableOpacity
                  style={styles.rejectTriggerBtn}
                  onPress={() => setShowRejectInput(true)}
                >
                  <Text style={styles.rejectTriggerText}>Decline</Text>
                </TouchableOpacity>
                <Button
                  title="Approve Charges"
                  variant="primary"
                  size="sm"
                  loading={partsSubmitting}
                  onPress={handleApproveSpareParts}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        )}

        {/* Booked Service Details Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Service Information</Text>
          <View style={styles.serviceRow}>
            <View style={styles.serviceIconHalo}>
              <Ionicons name="build" size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.serviceNameText}>
                {booking.service?.name || 'Booked Service'}
              </Text>
              {booking.service?.category?.name && (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {booking.service.category.name}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {booking.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Booking Instructions:</Text>
              <Text style={styles.notesVal}>{booking.notes}</Text>
            </View>
          ) : null}
        </Card>

        {/* Assigned Provider Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Assigned Service Provider</Text>
          <View style={styles.providerRow}>
            <View style={styles.providerAvatarHalo}>
              <Text style={styles.providerAvatarText}>
                {providerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.providerNameText}>{providerName}</Text>
              <View style={styles.providerMetaRow}>
                {provider?.rating > 0 && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={styles.ratingText}>
                      {Number(provider.rating).toFixed(1)}
                    </Text>
                  </View>
                )}
                {provider?.experienceYears > 0 && (
                  <Text style={styles.expText}>
                    {provider.experienceYears} yrs experience
                  </Text>
                )}
              </View>
            </View>

            {providerPhone && (
              <TouchableOpacity
                style={styles.callProviderBtn}
                onPress={() => handleCallProvider(providerPhone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
                <Text style={styles.callProviderBtnText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Schedule & Location Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Schedule & Location</Text>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#A78BFA" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Scheduled Date & Time</Text>
              <Text style={styles.infoVal}>
                {formatScheduledDate(booking.scheduledDate)}
                {booking.scheduledTimeSlot?.startTime &&
                  ` (${booking.scheduledTimeSlot.startTime} - ${booking.scheduledTimeSlot.endTime || ''})`}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#A78BFA" />
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Service Address</Text>
              <Text style={styles.infoVal}>{formatAddress(booking.address)}</Text>
              {booking.address?.landmark ? (
                <Text style={styles.landmarkText}>
                  Landmark: {booking.address.landmark}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Service Team Allocation Section */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Service Team Assignment</Text>
          {booking.serviceTeam?.isConfirmed && booking.serviceTeam?.totalCount ? (
            <View style={styles.teamConfirmedBox}>
              <View style={styles.teamConfirmedHeader}>
                <Ionicons name="people" size={18} color="#34D399" />
                <Text style={styles.teamConfirmedTitle}>
                  Confirmed: {booking.serviceTeam.totalCount === 1 ? '1 Person' : `${booking.serviceTeam.totalCount} People`}
                </Text>
              </View>
              {Array.isArray(booking.serviceTeam.roles) && booking.serviceTeam.roles.length > 0 && (
                <View style={styles.rolesWrap}>
                  {booking.serviceTeam.roles.map((r, idx) => (
                    <View key={idx} style={styles.rolePill}>
                      <Text style={styles.rolePillText}>
                        {r.role} ({r.count})
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {booking.serviceTeam.notes ? (
                <Text style={styles.teamNotesText}>Note: {booking.serviceTeam.notes}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.teamPendingBox}>
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
              <Text style={styles.teamPendingText}>
                Awaiting Provider Confirmation • The provider will confirm the team size and assigned technicians prior to arrival.
              </Text>
            </View>
          )}
        </Card>

        {/* Spare Parts Itemized Breakdown (if any) */}
        {hasSpareParts && (
          <Card style={styles.card}>
            <View style={styles.partsHeaderRow}>
              <Text style={styles.cardSectionTitle}>Spare Parts & Materials</Text>
              <Badge
                label={(booking.spareParts.status || 'PROPOSED').replace('_', ' ').toUpperCase()}
                variant={
                  booking.spareParts.status === 'approved'
                    ? 'success'
                    : booking.spareParts.status === 'rejected'
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
              />
            </View>

            {booking.spareParts.items.map((item, idx) => (
              <View key={idx} style={styles.partItemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partItemName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.partItemDesc}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.partItemMeta}>
                    Qty: {item.quantity} × ₹{item.unitPrice}
                    {item.labourCharge > 0 ? ` + Labour: ₹${item.labourCharge}` : ''}
                  </Text>
                </View>
                <Text style={styles.partItemTotal}>₹{item.totalPrice}</Text>
              </View>
            ))}

            <View style={styles.partsTotalsBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Parts Subtotal</Text>
                <Text style={styles.summaryVal}>₹{booking.spareParts.partsSubtotal || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Labour Subtotal</Text>
                <Text style={styles.summaryVal}>₹{booking.spareParts.labourSubtotal || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontWeight: '700', color: '#EDE9FE' }]}>
                  Additional Materials Total
                </Text>
                <Text style={[styles.summaryVal, { fontWeight: '700', color: '#34D399' }]}>
                  +₹{booking.spareParts.totalAdditionalAmount || 0}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Pricing & Bill Breakdown Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Pricing & Bill Breakdown</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Base Service Price</Text>
            <Text style={styles.summaryVal}>
              ₹{booking.pricing?.basePrice || booking.spareParts?.originalServiceAmount || booking.service?.price || 0}
            </Text>
          </View>

          {booking.pricing?.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount Applied</Text>
              <Text style={[styles.summaryVal, { color: '#34D399' }]}>
                -₹{booking.pricing.discount}
              </Text>
            </View>
          )}

          {booking.pricing?.tax > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxes & Fees</Text>
              <Text style={styles.summaryVal}>+₹{booking.pricing.tax}</Text>
            </View>
          )}

          {booking.spareParts?.status === 'approved' && booking.spareParts?.totalAdditionalAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Approved Extra Materials</Text>
              <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>
                +₹{booking.spareParts.totalAdditionalAmount}
              </Text>
            </View>
          )}

          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Total Payable Amount</Text>
              <Text style={styles.totalSub}>All inclusive of taxes & fees</Text>
            </View>
            <Text style={styles.totalAmountVal}>
              ₹{booking.pricing?.totalAmount || 0}
            </Text>
          </View>
        </Card>

        {/* Payment Details Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Payment Information</Text>

          <View style={styles.summaryRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={paymentMethodInfo.icon} size={15} color="#A78BFA" />
              <Text style={styles.summaryLabel}>Payment Method</Text>
            </View>
            <Text style={styles.summaryVal}>{paymentMethodInfo.label}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Status</Text>
            <Badge label={paymentBadge.label} variant={paymentBadge.variant} size="sm" />
          </View>

          {booking.paymentDetails?.razorpayPaymentId && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Transaction ID</Text>
              <Text style={styles.monoVal}>
                {booking.paymentDetails.razorpayPaymentId}
              </Text>
            </View>
          )}
        </Card>

        {/* Booking Timeline Card */}
        <Card style={styles.card}>
          <Text style={styles.cardSectionTitle}>Booking Timeline</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.timelineDotActive]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Booking Created</Text>
                <Text style={styles.timelineTime}>
                  {formatTimestamp(booking.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  booking.statusTimestamps?.acceptedAt && styles.timelineDotActive
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Provider Assigned & Accepted</Text>
                <Text style={styles.timelineTime}>
                  {formatTimestamp(booking.statusTimestamps?.acceptedAt) || 'Pending provider confirmation'}
                </Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  booking.statusTimestamps?.inProgressAt && styles.timelineDotActive
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Service In Progress</Text>
                <Text style={styles.timelineTime}>
                  {formatTimestamp(booking.statusTimestamps?.inProgressAt) || 'Awaiting service start'}
                </Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  booking.status === 'completed'
                    ? styles.timelineDotActive
                    : booking.status === 'cancelled'
                    ? styles.timelineDotDanger
                    : null
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>
                  {booking.status === 'cancelled' ? 'Booking Cancelled' : 'Service Completed'}
                </Text>
                <Text style={styles.timelineTime}>
                  {formatTimestamp(booking.statusTimestamps?.completedAt || booking.statusTimestamps?.cancelledAt) ||
                    (booking.status === 'cancelled' ? 'Cancelled' : 'Pending completion')}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Rating & Review Section (for completed bookings) */}
        {booking.status === 'completed' && (
          <Card style={styles.card}>
            <Text style={styles.cardSectionTitle}>Service Rating & Feedback</Text>
            {booking.review ? (
              <View style={styles.reviewBox}>
                <View style={styles.reviewHeader}>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= booking.review.rating ? 'star' : 'star-outline'}
                        size={16}
                        color="#FBBF24"
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewRatingText}>
                    {booking.review.rating}.0 / 5
                  </Text>
                </View>
                {booking.review.comment ? (
                  <Text style={styles.reviewCommentText}>
                    "{booking.review.comment}"
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.noReviewBox}>
                <Text style={styles.noReviewPrompt}>
                  How was your experience with {providerName}? Share your feedback to help others.
                </Text>
                <Button
                  title="Rate & Review Service"
                  variant="primary"
                  onPress={() => setShowReviewModal(true)}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          </Card>
        )}

        {/* Contextual Actions (Cancel Booking for pending) */}
        {booking.status === 'pending' && (
          <View style={styles.actionSection}>
            <Button
              title={cancelling ? 'Cancelling...' : 'Cancel Booking Request'}
              variant="danger"
              loading={cancelling}
              disabled={cancelling}
              onPress={handleCancelBooking}
            />
          </View>
        )}
      </ScrollView>

      {/* Review Submission Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Service</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              How would you rate the service provided by {providerName}?
            </Text>

            <View style={styles.starSelectRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={32}
                    color="#FBBF24"
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Write your review here (optional)..."
              placeholderTextColor="#6B7280"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            {reviewError ? (
              <Text style={styles.reviewErrorText}>{reviewError}</Text>
            ) : null}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Button
                title={submittingReview ? 'Submitting...' : 'Submit Review'}
                variant="primary"
                loading={submittingReview}
                onPress={handleSubmitReview}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scrollContent: {
    padding: spacing.md,
    alignItems: 'center'
  },
  heroCard: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  refBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#201A36',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#3D2F66'
  },
  refText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#DDD6FE'
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  modeText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(124, 58, 237, 0.12)'
  },
  copyBtnText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '600'
  },
  copyBtnTextActive: {
    color: '#34D399'
  },
  bookedOnText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: spacing.sm
  },
  partsAlertBox: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  partsAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  partsAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B'
  },
  partsAlertDesc: {
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 18,
    marginBottom: spacing.md
  },
  partsAlertBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  rejectTriggerBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectTriggerText: {
    color: '#F43F5E',
    fontSize: 13,
    fontWeight: '600'
  },
  rejectInputWrap: {
    gap: spacing.sm
  },
  rejectInput: {
    backgroundColor: '#1E1929',
    borderWidth: 1,
    borderColor: '#382F52',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: '#FFFFFF',
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  rejectActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    alignItems: 'center'
  },
  cancelRejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  cancelRejectText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600'
  },
  card: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#A78BFA',
    marginBottom: spacing.md
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  serviceIconHalo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  serviceNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 22
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#201A36',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DDD6FE'
  },
  notesBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#201D2D'
  },
  notesLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  notesVal: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 2,
    lineHeight: 17
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  providerAvatarHalo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center'
  },
  providerAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  providerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24'
  },
  expText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  callProviderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md
  },
  callProviderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#201D2D'
  },
  infoTextWrap: {
    flex: 1
  },
  infoLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  infoVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18
  },
  landmarkText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  teamConfirmedBox: {
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    padding: spacing.md,
    borderRadius: borderRadius.md
  },
  teamConfirmedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs
  },
  teamConfirmedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399'
  },
  rolesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  rolePill: {
    backgroundColor: '#1E1929',
    borderWidth: 1,
    borderColor: '#3D2F66',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full
  },
  rolePillText: {
    fontSize: 11,
    color: '#DDD6FE',
    fontWeight: '600'
  },
  teamNotesText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6
  },
  teamPendingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: spacing.md,
    borderRadius: borderRadius.md
  },
  teamPendingText: {
    flex: 1,
    fontSize: 12,
    color: '#FCD34D',
    lineHeight: 17
  },
  partsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  partItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#201D2D'
  },
  partItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  partItemDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1
  },
  partItemMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  partItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  partsTotalsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#201D2D'
  },
  summaryLabel: {
    fontSize: 13,
    color: '#9CA3AF'
  },
  summaryVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600'
  },
  monoVal: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#DDD6FE',
    fontWeight: '600'
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  totalSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  totalAmountVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#34D399'
  },
  timeline: {
    paddingLeft: spacing.sm
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#374151',
    marginTop: 3
  },
  timelineDotActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowRadius: 6,
    shadowOpacity: 0.6
  },
  timelineDotDanger: {
    backgroundColor: '#EF4444'
  },
  timelineContent: {
    flex: 1
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  timelineTime: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2
  },
  reviewBox: {
    backgroundColor: '#201A36',
    borderWidth: 1,
    borderColor: '#3D2F66',
    borderRadius: borderRadius.md,
    padding: spacing.md
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  starRow: {
    flexDirection: 'row',
    gap: 2
  },
  reviewRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24'
  },
  reviewCommentText: {
    fontSize: 12,
    color: '#DDD6FE',
    fontStyle: 'italic',
    lineHeight: 18
  },
  noReviewBox: {
    backgroundColor: '#1A1828',
    borderRadius: borderRadius.md,
    padding: spacing.md
  },
  noReviewPrompt: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: spacing.xs
  },
  actionSection: {
    width: '100%',
    maxWidth: 600,
    marginTop: spacing.sm
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalContent: {
    backgroundColor: '#161420',
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A253E',
    padding: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: spacing.md
  },
  starSelectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.md
  },
  reviewInput: {
    backgroundColor: '#0F0E16',
    borderWidth: 1,
    borderColor: '#2F2947',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    color: '#FFFFFF',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md
  },
  reviewErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: spacing.sm
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center'
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#362E52'
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF'
  }
});
