import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Platform
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
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [partsList, setPartsList] = useState([]);
  const [partsSubmitting, setPartsSubmitting] = useState(false);

  // Service Team Size state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamTotalCount, setTeamTotalCount] = useState(1);
  const [teamRoles, setTeamRoles] = useState([
    { role: 'Main Technician', count: 1 }
  ]);
  const [teamNotes, setTeamNotes] = useState('');
  const [teamReason, setTeamReason] = useState('');
  const [teamSubmitting, setTeamSubmitting] = useState(false);

  const openTeamModal = () => {
    if (booking?.serviceTeam?.totalCount) {
      setTeamTotalCount(booking.serviceTeam.totalCount);
      if (Array.isArray(booking.serviceTeam.roles) && booking.serviceTeam.roles.length > 0) {
        setTeamRoles(booking.serviceTeam.roles.map(r => ({ role: r.role, count: r.count })));
      } else {
        setTeamRoles([
          { role: 'Main Technician', count: 1 },
          ...(booking.serviceTeam.totalCount > 1
            ? [{ role: 'Helper', count: booking.serviceTeam.totalCount - 1 }]
            : [])
        ]);
      }
      setTeamNotes(booking.serviceTeam.notes || '');
    } else {
      setTeamTotalCount(1);
      setTeamRoles([{ role: 'Main Technician', count: 1 }]);
      setTeamNotes('');
    }
    setTeamReason('');
    setShowTeamModal(true);
  };

  const handleSaveTeamSize = async () => {
    if (teamTotalCount < 1) {
      Alert.alert('Invalid Team Size', 'Total team size must be at least 1 person (including you).');
      return;
    }

    // Validate role counts sum <= totalCount
    const roleSum = teamRoles.reduce((sum, r) => sum + (parseInt(r.count, 10) || 0), 0);
    if (roleSum > teamTotalCount) {
      Alert.alert(
        'Role Count Exceeds Total',
        `The sum of role counts (${roleSum}) exceeds your total team size (${teamTotalCount}). Please adjust counts.`
      );
      return;
    }

    // Require reason if booking is in_progress
    if (booking?.status === 'in_progress' && !teamReason.trim()) {
      Alert.alert(
        'Reason Required',
        'Service is already in progress. Please specify a reason for modifying the service team size.'
      );
      return;
    }

    setTeamSubmitting(true);
    try {
      const payload = {
        totalCount: teamTotalCount,
        roles: teamRoles.filter(r => r.role.trim() && (parseInt(r.count, 10) || 0) > 0),
        notes: teamNotes.trim(),
        reason: teamReason.trim()
      };
      const res = await bookingApi.updateTeamSize(booking._id, payload);
      if (res?.success) {
        setBooking(res.data);
        setShowTeamModal(false);
        Alert.alert(
          'Team Size Confirmed',
          `Service team size (${teamTotalCount === 1 ? '1 person' : `${teamTotalCount} people`}) updated and notified to the customer.`
        );
      }
    } catch (err) {
      Alert.alert('Update Failed', err.userMessage || 'Could not update service team size');
    } finally {
      setTeamSubmitting(false);
    }
  };

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

  const handleMarkCashReceived = async () => {
    // Check if extra materials proposal is pending customer approval
    if (
      booking.spareParts &&
      ['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)
    ) {
      Alert.alert(
        'Action Required',
        'Cannot collect cash while extra materials proposal is awaiting customer approval. The customer must approve or reject the proposal first.'
      );
      return;
    }

    const isExtraCashOnly =
      booking.paymentMethod === 'online' &&
      booking.spareParts?.status === 'approved' &&
      booking.spareParts?.paymentMethod === 'cash';

    const payableAmount = isExtraCashOnly
      ? Number(booking.spareParts?.totalAdditionalAmount || 0)
      : Number(booking.pricing?.totalAmount || 0);

    const alertTitle = isExtraCashOnly ? 'Confirm Extra Cash Collection' : 'Confirm Cash Payment';
    const alertMessage = isExtraCashOnly
      ? `Have you collected ₹${payableAmount} in cash from the customer for the approved extra materials?`
      : `Have you collected the full amount of ₹${payableAmount} in cash from the customer?`;

    const executeMarkCashReceived = async () => {
      setActionLoading(true);
      try {
        const res = await bookingApi.confirmCashPayment(booking._id);
        if (res?.success) {
          const successMsg = isExtraCashOnly
            ? `Extra cash of ₹${payableAmount} recorded successfully. Remaining balance: ₹0.`
            : `Cash payment of ₹${payableAmount} recorded successfully. Remaining balance: ₹0.`;
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
            window.alert(`[Payment Recorded] ${successMsg}`);
          } else {
            Alert.alert('Payment Recorded', successMsg);
          }
          setBooking(res.data);
        }
      } catch (err) {
        const errMsg = err.userMessage || 'Could not record cash payment';
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert(`[Error] ${errMsg}`);
        } else {
          Alert.alert('Error', errMsg);
        }
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm(`${alertTitle}\n\n${alertMessage}`)
        : true;
      if (confirmed) {
        executeMarkCashReceived();
      }
      return;
    }

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isExtraCashOnly ? 'Confirm Extra Cash' : 'Confirm Cash Received',
          onPress: executeMarkCashReceived
        }
      ]
    );
  };

  const handleCompleteService = async () => {
    // 1. Check if extra materials proposal is pending customer approval
    if (
      booking.spareParts &&
      ['pending_approval', 'pending_customer_approval'].includes(booking.spareParts.status)
    ) {
      const msg = 'Your extra materials proposal is awaiting customer approval. The customer must approve or reject the proposal before this job can be completed.';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`[Action Required] ${msg}`);
      } else {
        Alert.alert('Action Required', msg);
      }
      return;
    }

    // 2. Check if cash for booking or spare parts is unpaid
    if (booking.paymentMethod === 'cash' && booking.paymentStatus !== 'paid') {
      const msg = `Please collect cash (₹${booking.pricing?.totalAmount || 0}) from the customer and tap "Mark Cash Received" before completing the service.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`[Cash Collection Required] ${msg}`);
      } else {
        Alert.alert('Cash Collection Required', msg);
      }
      return;
    }

    // 3. Check if extra materials were approved with cash selected and cash is not yet marked received
    if (
      booking.spareParts &&
      booking.spareParts.status === 'approved' &&
      booking.spareParts.paymentMethod === 'cash' &&
      booking.spareParts.paymentStatus !== 'paid' &&
      booking.spareParts.totalAdditionalAmount > 0
    ) {
      const msg = `The customer selected Cash on Service for approved extra materials (₹${booking.spareParts.totalAdditionalAmount}). Please collect cash and tap "Collect Extra Cash" before completing the service.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`[Cash Collection Required] ${msg}`);
      } else {
        Alert.alert('Cash Collection Required', msg);
      }
      return;
    }

    // 4. Check if extra materials were approved with online payment pending
    if (
      booking.spareParts &&
      booking.spareParts.status === 'approved' &&
      (booking.spareParts.paymentMethod === 'online' || !booking.spareParts.paymentMethod) &&
      booking.spareParts.paymentStatus !== 'paid' &&
      booking.spareParts.totalAdditionalAmount > 0
    ) {
      const msg = `The customer has approved extra materials (+₹${booking.spareParts.totalAdditionalAmount}) but has not completed payment yet. Please ask the customer to pay via their Customer App before completing.`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`[Payment Pending] ${msg}`);
      } else {
        Alert.alert('Payment Pending', msg);
      }
      return;
    }

    if (actionLoading) return;

    const executeCompleteService = async () => {
      if (actionLoading) return;
      setActionLoading(true);
      try {
        const res = await bookingApi.completeService(booking._id);
        if (res?.success && res.data) {
          setBooking(res.data);
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
            window.alert('[Service Completed] Job completed successfully! Order recorded.');
          } else {
            Alert.alert(
              'Service Completed',
              'Job completed successfully! Order recorded.',
              [
                {
                  text: 'View Details',
                  onPress: () => fetchDetail()
                },
                {
                  text: 'Go to Bookings',
                  onPress: () => navigation.navigate('HistoryTab')
                }
              ]
            );
          }
        }
      } catch (err) {
        const isConflict =
          err.response?.status === 409 ||
          /concurrent|already completed|state conflict|not found/i.test(err.message || '');
        const errorMsg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.userMessage ||
          err.message ||
          'Could not complete service';

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert(`[${isConflict ? 'Status Updated' : 'Cannot Complete Service'}] ${errorMsg}`);
        } else {
          Alert.alert(
            isConflict ? 'Status Updated' : 'Cannot Complete Service',
            errorMsg,
            [
              {
                text: 'Refresh',
                onPress: () => fetchDetail()
              }
            ]
          );
        }
        fetchDetail();
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Complete Service\n\nAre you sure you want to mark this job as completed?')
        : true;
      if (confirmed) {
        executeCompleteService();
      }
      return;
    }

    Alert.alert(
      'Complete Service',
      'Are you sure you want to mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Completed',
          onPress: executeCompleteService
        }
      ]
    );
  };

  const handleAcceptRequest = async () => {
    if (!booking?._id || actionLoading) return;

    setActionLoading(true);
    try {
      const res = await bookingApi.acceptBooking(booking._id);
      if (res?.success) {
        Alert.alert('Accepted', 'You have claimed this booking.');
        setBooking(res.data);
      }
    } catch (err) {
      const isConflict = err.response?.status === 409 || /no longer pending|already claimed|conflict/i.test(err.message || '');
      Alert.alert(
        'Request Unavailable',
        isConflict
          ? 'This request has already been accepted or is no longer available.'
          : (err.userMessage || err.message || 'Could not accept booking')
      );
      fetchDetail();
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

  // Initialize partsList from existing booking spareParts
  const openPartsModal = () => {
    if (booking?.spareParts?.items?.length) {
      setPartsList(
        booking.spareParts.items.map((item) => ({
          name: item.name || '',
          description: item.description || '',
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unitPrice || 0),
          labourCharge: String(item.labourCharge || 0),
          notes: item.notes || ''
        }))
      );
    } else {
      // Spare parts are optional: start with an empty list
      setPartsList([]);
    }
    setShowPartsModal(true);
  };

  const handleAddPartRow = () => {
    setPartsList((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        quantity: '1',
        unitPrice: '',
        labourCharge: '0',
        notes: ''
      }
    ]);
  };

  const handleRemovePartRow = (index) => {
    setPartsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePartRow = (index, field, value) => {
    setPartsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const calculateProposedTotals = () => {
    let partsSubtotal = 0;
    let labourSubtotal = 0;
    partsList.forEach((p) => {
      const q = Math.max(1, parseInt(p.quantity, 10) || 1);
      const u = Math.max(0, parseFloat(p.unitPrice) || 0);
      const l = Math.max(0, parseFloat(p.labourCharge) || 0);
      partsSubtotal += q * u;
      labourSubtotal += l;
    });
    const totalAdditional = partsSubtotal + labourSubtotal;
    const originalAmount = booking?.spareParts?.originalServiceAmount || booking?.pricing?.totalAmount || 0;
    return {
      partsSubtotal: Math.round(partsSubtotal * 100) / 100,
      labourSubtotal: Math.round(labourSubtotal * 100) / 100,
      totalAdditional: Math.round(totalAdditional * 100) / 100,
      newEstimatedTotal: Math.round((originalAmount + totalAdditional) * 100) / 100
    };
  };

  const handleSubmitParts = async () => {
    // Spare parts are optional: only validate rows if provider added materials
    if (partsList.length > 0) {
      for (let i = 0; i < partsList.length; i++) {
        const p = partsList[i];
        if (!p.name || !p.name.trim()) {
          const msg = `Part #${i + 1} is missing a name.`;
          Platform.OS === 'web' && typeof window !== 'undefined' && window.alert ? window.alert(msg) : Alert.alert('Validation Error', msg);
          return;
        }
        const q = parseInt(p.quantity, 10);
        if (isNaN(q) || q < 1) {
          const msg = `Part #${i + 1} must have a quantity of at least 1.`;
          Platform.OS === 'web' && typeof window !== 'undefined' && window.alert ? window.alert(msg) : Alert.alert('Validation Error', msg);
          return;
        }
        const u = parseFloat(p.unitPrice);
        if (isNaN(u) || u < 0) {
          const msg = `Part #${i + 1} must have a valid non-negative unit price.`;
          Platform.OS === 'web' && typeof window !== 'undefined' && window.alert ? window.alert(msg) : Alert.alert('Validation Error', msg);
          return;
        }
        const l = parseFloat(p.labourCharge || 0);
        if (isNaN(l) || l < 0) {
          const msg = `Part #${i + 1} labour charge cannot be negative.`;
          Platform.OS === 'web' && typeof window !== 'undefined' && window.alert ? window.alert(msg) : Alert.alert('Validation Error', msg);
          return;
        }
      }
    }

    setPartsSubmitting(true);
    try {
      const itemsPayload = partsList.map((p) => ({
        name: p.name.trim(),
        description: p.description?.trim() || undefined,
        quantity: parseInt(p.quantity, 10) || 1,
        unitPrice: parseFloat(p.unitPrice) || 0,
        labourCharge: parseFloat(p.labourCharge) || 0,
        notes: p.notes?.trim() || undefined
      }));

      const res = await bookingApi.submitSpareParts(booking._id, { items: itemsPayload });
      if (res?.success) {
        const successMsg = itemsPayload.length > 0
          ? 'Spare parts bill submitted for customer approval.'
          : 'No extra materials recorded. Final total remains base service price.';
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert(successMsg);
        } else {
          Alert.alert('Success', successMsg);
        }
        setBooking(res.data);
        setShowPartsModal(false);
      }
    } catch (err) {
      const errMsg = err.userMessage || err.message || 'Could not submit spare parts';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
        window.alert(`[Submission Failed] ${errMsg}`);
      } else {
        Alert.alert('Submission Failed', errMsg);
      }
    } finally {
      setPartsSubmitting(false);
    }
  };

  const canAddParts =
    (booking.status === 'accepted' || booking.status === 'in_progress') &&
    booking.spareParts?.status !== 'approved';

  const modalTotals = calculateProposedTotals();

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
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
            <Text style={styles.metaLabel}>Payment Status</Text>
            <Text style={[styles.metaVal, { textTransform: 'capitalize' }]}>
              {booking.paymentStatus || 'Pending'} ({booking.paymentMethod?.toUpperCase() || 'CASH'})
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

        {/* Service Team Size Card */}
        <Card style={styles.card}>
          <View style={styles.partsHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Service Team Size</Text>
              <Text style={styles.sectionSubtitle}>
                Specify people attending to perform service
              </Text>
            </View>
            <Badge
              label={booking.serviceTeam?.isConfirmed ? 'CONFIRMED' : 'NOT CONFIRMED'}
              variant={booking.serviceTeam?.isConfirmed ? 'success' : 'warning'}
              size="sm"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A162B', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2D2845' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#2E1065', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people" size={18} color="#A78BFA" />
                </View>
                <View>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                    {booking.serviceTeam?.isConfirmed && booking.serviceTeam?.totalCount
                      ? booking.serviceTeam.totalCount === 1
                        ? '1 person attending'
                        : `${booking.serviceTeam.totalCount} people attending`
                      : 'Team size not confirmed'}
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>
                    Main service provider included in count
                  </Text>
                </View>
              </View>
              {(booking.status === 'accepted' || booking.status === 'in_progress') && (
                <TouchableOpacity
                  onPress={openTeamModal}
                  style={{
                    backgroundColor: '#7C3AED',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 6
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    {booking.serviceTeam?.isConfirmed ? 'Update Team' : 'Configure'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Role Breakdown if configured */}
            {booking.serviceTeam?.isConfirmed && Array.isArray(booking.serviceTeam?.roles) && booking.serviceTeam.roles.length > 0 && (
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {booking.serviceTeam.roles.map((r, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: '#252136',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#3B3355'
                    }}
                  >
                    <Text style={{ color: '#DDD6FE', fontSize: 12, fontWeight: '600' }}>
                      {r.role}: {r.count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* In-progress notice or notes */}
            {booking.serviceTeam?.notes ? (
              <Text style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic', marginTop: 8 }}>
                Notes: {booking.serviceTeam.notes}
              </Text>
            ) : null}

            {/* Update history count if available */}
            {Array.isArray(booking.serviceTeam?.history) && booking.serviceTeam.history.length > 1 && (
              <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 6 }}>
                Last updated at {new Date(booking.serviceTeam.history[booking.serviceTeam.history.length - 1].updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </Card>

        {/* Spare Parts & Materials Card */}
        <Card style={styles.card}>
          <View style={styles.partsHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Spare Parts & Materials</Text>
              <Text style={styles.sectionSubtitle}>
                Add replacement components & installation fees (Optional)
              </Text>
            </View>
            {booking.spareParts?.status && booking.spareParts.status !== 'none' && (
              <Badge
                label={booking.spareParts.status.replace('_', ' ').toUpperCase()}
                variant={
                  booking.spareParts.status === 'approved'
                    ? 'success'
                    : booking.spareParts.status === 'rejected'
                    ? 'danger'
                    : 'warning'
                }
                size="sm"
              />
            )}
          </View>

          {booking.spareParts?.items?.length > 0 ? (
            <View style={styles.partsBreakdownBox}>
              {booking.spareParts.items.map((item, idx) => (
                <View key={idx} style={styles.partItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partItemName}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.partItemDesc}>{item.description}</Text>
                    ) : null}
                    <Text style={styles.partItemMeta}>
                      Qty: {item.quantity} × ₹{item.unitPrice}
                      {item.labourCharge > 0 ? ` + Labour: ₹${item.labourCharge}` : ''}
                    </Text>
                    {item.notes ? (
                      <Text style={styles.partItemNotes}>Note: {item.notes}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.partItemTotal}>₹{item.totalPrice}</Text>
                </View>
              ))}

              <View style={styles.partsDivider} />

              <View style={styles.partsSummaryRow}>
                <Text style={styles.partsSummaryLabel}>Parts Subtotal</Text>
                <Text style={styles.partsSummaryVal}>₹{booking.spareParts.partsSubtotal || 0}</Text>
              </View>
              <View style={styles.partsSummaryRow}>
                <Text style={styles.partsSummaryLabel}>Labour Subtotal</Text>
                <Text style={styles.partsSummaryVal}>₹{booking.spareParts.labourSubtotal || 0}</Text>
              </View>
              <View style={styles.partsSummaryRow}>
                <Text style={styles.partsSummaryTotalLabel}>Additional Charges</Text>
                <Text style={styles.partsSummaryTotalVal}>
                  ₹{booking.spareParts.totalAdditionalAmount || 0}
                </Text>
              </View>

              {booking.spareParts.status === 'rejected' && booking.spareParts.rejectionReason ? (
                <View style={styles.rejectionBox}>
                  <Ionicons name="alert-circle" size={18} color="#F43F5E" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rejectionText, { fontWeight: '700', marginBottom: 2 }]}>
                      Proposal Declined by Customer:
                    </Text>
                    <Text style={styles.rejectionText}>
                      "{booking.spareParts.rejectionReason}"
                    </Text>
                    <Text style={[styles.rejectionText, { color: '#CBD5E1', marginTop: 4, fontSize: 11 }]}>
                      You can revise the items or prices below and resubmit for customer approval.
                    </Text>
                  </View>
                </View>
              ) : null}

              {(booking.spareParts.status === 'pending_approval' ||
                booking.spareParts.status === 'pending_customer_approval') && (
                <View
                  style={[
                    styles.rejectionBox,
                    { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }
                  ]}
                >
                  <Ionicons name="time-outline" size={18} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rejectionText, { color: '#F59E0B', fontWeight: '700', marginBottom: 2 }]}>
                      Awaiting Customer Approval
                    </Text>
                    <Text style={[styles.rejectionText, { color: '#E2E8F0' }]}>
                      Your extra materials proposal (+₹{booking.spareParts.totalAdditionalAmount || 0}) is pending customer review. The customer must approve or reject this proposal before this job can be completed.
                    </Text>
                  </View>
                </View>
              )}

              {booking.spareParts.status === 'approved' && (
                <View style={styles.approvedBox}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.approvedText}>
                      Approved by customer. Total revised to ₹{booking.pricing?.totalAmount}.
                    </Text>
                    <Text style={[styles.approvedText, { marginTop: 3, fontWeight: '700' }]}>
                      {booking.spareParts.paymentStatus === 'paid' ? (
                        booking.spareParts.paymentMethod === 'cash' ? (
                          <Text style={{ color: '#10B981' }}>
                            ✓ Extra cash collected (₹{booking.spareParts.totalAdditionalAmount}) • Remaining balance: ₹0
                          </Text>
                        ) : (
                          <Text style={{ color: '#10B981' }}>
                            ✓ Additional charges (₹{booking.spareParts.totalAdditionalAmount}) paid online • Remaining balance: ₹0
                          </Text>
                        )
                      ) : booking.spareParts.paymentMethod === 'cash' ? (
                        <Text style={{ color: '#FBBF24' }}>
                          💵 Customer selected Cash on Service: Collect ₹{booking.spareParts.totalAdditionalAmount} in cash from customer.
                        </Text>
                      ) : (
                        <Text style={{ color: '#A78BFA' }}>
                          💳 Customer paying online via Razorpay (Payment pending).
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noPartsText}>No spare parts added to this booking yet (Optional).</Text>
          )}

          {canAddParts && (
            <TouchableOpacity
              style={[
                styles.addPartsBtn,
                booking.spareParts?.status === 'rejected' && {
                  backgroundColor: '#7C3AED',
                  borderColor: '#A78BFA'
                }
              ]}
              onPress={openPartsModal}
              activeOpacity={0.8}
            >
              <Ionicons
                name="construct-outline"
                size={16}
                color={booking.spareParts?.status === 'rejected' ? '#FFFFFF' : '#A78BFA'}
              />
              <Text
                style={[
                  styles.addPartsBtnText,
                  booking.spareParts?.status === 'rejected' && { color: '#FFFFFF', fontWeight: '700' }
                ]}
              >
                {booking.spareParts?.status === 'rejected'
                  ? 'Revise & Resubmit Proposal'
                  : booking.spareParts?.items?.length
                  ? 'Edit Spare Parts Bill'
                  : '+ Add Spare Parts & Labour (Optional)'}
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Customer & Location Details */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Customer & Service Location</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="person" size={16} color="#A78BFA" />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoTitle}>{booking.customer?.user?.name || 'Customer'}</Text>
              <Text style={styles.infoSub}>{booking.customer?.user?.phone || 'No phone provided'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="location" size={16} color="#A78BFA" />
            </View>
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
            <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
              {((booking.paymentMethod === 'cash' && booking.paymentStatus !== 'paid') ||
                (booking.spareParts?.status === 'approved' &&
                  booking.spareParts?.paymentMethod === 'cash' &&
                  booking.spareParts?.paymentStatus !== 'paid')) && (
                <Button
                  title={
                    actionLoading
                      ? 'Recording...'
                      : booking.paymentMethod === 'online'
                      ? `Collect Extra Cash (₹${booking.spareParts?.totalAdditionalAmount || 0})`
                      : 'Mark Cash Received'
                  }
                  variant="primary"
                  loading={actionLoading}
                  disabled={actionLoading}
                  onPress={handleMarkCashReceived}
                  style={[styles.actionBtn, { flex: 1, backgroundColor: '#059669' }]}
                />
              )}
              <Button
                title={actionLoading ? 'Completing...' : 'Mark Job Completed'}
                variant="success"
                loading={actionLoading}
                disabled={actionLoading}
                onPress={handleCompleteService}
                style={[styles.actionBtn, { flex: 1 }]}
              />
            </View>
          )}
        </View>
      )}

      {/* Spare Parts Entry Modal */}
      {showPartsModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Spare Parts & Materials</Text>
                <Text style={styles.modalSubtitle}>Optional • Bill items used for this job</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPartsModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {partsList.length === 0 ? (
                <View style={styles.emptyPartsModalBox}>
                  <Ionicons name="construct-outline" size={26} color="#A78BFA" />
                  <Text style={styles.emptyPartsModalTitle}>Spare Parts & Materials are Optional</Text>
                  <Text style={styles.emptyPartsModalText}>
                    No materials added yet. If you did not use any replacement parts or materials for this service, you can confirm no extra materials below or tap cancel to return.
                  </Text>
                </View>
              ) : (
                partsList.map((item, index) => {
                  const q = Math.max(1, parseInt(item.quantity, 10) || 1);
                  const u = Math.max(0, parseFloat(item.unitPrice) || 0);
                  const l = Math.max(0, parseFloat(item.labourCharge) || 0);
                  const lineTotal = Math.round((q * u + l) * 100) / 100;

                  return (
                    <View key={index} style={styles.partCardInput}>
                      <View style={styles.partCardInputHeader}>
                        <Text style={styles.partCardIndexText}>Part / Material #{index + 1}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemovePartRow(index)}
                          style={styles.removePartBtn}
                          accessibilityLabel={`Remove Part #${index + 1}`}
                        >
                          <Ionicons name="trash-outline" size={16} color="#F43F5E" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.inputLabel}>Item Name *</Text>
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. Copper Pipe, Motor Capacitor, MCB"
                        placeholderTextColor="#6B7280"
                        value={item.name}
                        onChangeText={(val) => handleUpdatePartRow(index, 'name', val)}
                      />

                      <Text style={styles.inputLabel}>Description / Model (Optional)</Text>
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. Havells 25A 10kA C-Curve"
                        placeholderTextColor="#6B7280"
                        value={item.description}
                        onChangeText={(val) => handleUpdatePartRow(index, 'description', val)}
                      />

                      <View style={styles.inputRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.inputLabel}>Qty *</Text>
                          <TextInput
                            style={styles.inputField}
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor="#6B7280"
                            value={item.quantity}
                            onChangeText={(val) => handleUpdatePartRow(index, 'quantity', val)}
                          />
                        </View>
                        <View style={{ flex: 1.5, marginRight: 8 }}>
                          <Text style={styles.inputLabel}>Unit Price (₹) *</Text>
                          <TextInput
                            style={styles.inputField}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#6B7280"
                            value={item.unitPrice}
                            onChangeText={(val) => handleUpdatePartRow(index, 'unitPrice', val)}
                          />
                        </View>
                        <View style={{ flex: 1.5 }}>
                          <Text style={styles.inputLabel}>Labour (₹)</Text>
                          <TextInput
                            style={styles.inputField}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#6B7280"
                            value={item.labourCharge}
                            onChangeText={(val) => handleUpdatePartRow(index, 'labourCharge', val)}
                          />
                        </View>
                      </View>

                      <Text style={styles.inputLabel}>Notes (Optional)</Text>
                      <TextInput
                        style={styles.inputField}
                        placeholder="e.g. Original Havells box provided to customer"
                        placeholderTextColor="#6B7280"
                        value={item.notes}
                        onChangeText={(val) => handleUpdatePartRow(index, 'notes', val)}
                      />

                      <View style={styles.lineTotalRow}>
                        <Text style={styles.lineTotalLabel}>Line Total:</Text>
                        <Text style={styles.lineTotalVal}>₹{lineTotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={styles.addAnotherBtn}
                onPress={handleAddPartRow}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color="#A78BFA" />
                <Text style={styles.addAnotherText}>
                  {partsList.length === 0 ? '+ Add Spare Part or Material' : '+ Add Another Part / Item'}
                </Text>
              </TouchableOpacity>

              {/* Estimate Summary Box */}
              <View style={styles.estimateBox}>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Base Service Price:</Text>
                  <Text style={styles.estimateVal}>
                    ₹{booking?.pricing?.basePrice || booking?.service?.price || booking?.spareParts?.originalServiceAmount || 0}
                  </Text>
                </View>
                {(booking?.pricing?.discount > 0) && (
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Applicable Discount:</Text>
                    <Text style={[styles.estimateVal, { color: '#10B981' }]}>
                      -₹{booking.pricing.discount}
                    </Text>
                  </View>
                )}
                {(booking?.pricing?.tax > 0) && (
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Applicable Taxes / Fees:</Text>
                    <Text style={styles.estimateVal}>
                      +₹{booking.pricing.tax}
                    </Text>
                  </View>
                )}
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Extra Materials Subtotal:</Text>
                  <Text style={styles.estimateVal}>₹{modalTotals.partsSubtotal}</Text>
                </View>
                {modalTotals.labourSubtotal > 0 && (
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Extra Labour Subtotal:</Text>
                    <Text style={styles.estimateVal}>₹{modalTotals.labourSubtotal}</Text>
                  </View>
                )}
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Total Extra Proposed:</Text>
                  <Text
                    style={[
                      styles.estimateVal,
                      { color: modalTotals.totalAdditional > 0 ? '#F59E0B' : '#9CA3AF' }
                    ]}
                  >
                    {modalTotals.totalAdditional > 0 ? `+₹${modalTotals.totalAdditional}` : '₹0'}
                  </Text>
                </View>
                <View style={styles.estimateDivider} />
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateTotalLabel}>New Revised Final Total:</Text>
                  <Text style={styles.estimateTotalVal}>₹{modalTotals.newEstimatedTotal}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowPartsModal(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <Button
                title={
                  partsSubmitting
                    ? 'Submitting...'
                    : partsList.length === 0
                    ? 'Confirm (No Extra Materials)'
                    : booking.spareParts?.status === 'rejected'
                    ? 'Resubmit Revised Proposal'
                    : 'Submit for Approval'
                }
                variant="primary"
                loading={partsSubmitting}
                disabled={partsSubmitting}
                onPress={handleSubmitParts}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Team Size Configuration Modal */}
      {showTeamModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Service Team Size</Text>
                <Text style={styles.modalSubtitle}>
                  {booking.status === 'in_progress' ? 'Authorized team change in progress' : 'Specify team members attending'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !teamSubmitting && setShowTeamModal(false)}
                style={styles.modalCloseBtn}
                disabled={teamSubmitting}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Stepper for Total Team Count */}
              <View style={{ backgroundColor: '#161420', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#252136', marginBottom: 16 }}>
                <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                  Total Team Members *
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 14 }}>
                  Must include yourself (the main service provider).
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <TouchableOpacity
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: teamTotalCount > 1 ? '#7C3AED' : '#2D2845',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={() => {
                      if (teamTotalCount > 1) {
                        const newCount = teamTotalCount - 1;
                        setTeamTotalCount(newCount);
                      }
                    }}
                    disabled={teamTotalCount <= 1}
                  >
                    <Ionicons name="remove" size={24} color="#FFFFFF" />
                  </TouchableOpacity>

                  <View style={{ minWidth: 80, alignItems: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800' }}>
                      {teamTotalCount}
                    </Text>
                    <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600' }}>
                      {teamTotalCount === 1 ? 'person' : 'people'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: teamTotalCount < 50 ? '#7C3AED' : '#2D2845',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={() => {
                      if (teamTotalCount < 50) {
                        const newCount = teamTotalCount + 1;
                        setTeamTotalCount(newCount);
                      }
                    }}
                    disabled={teamTotalCount >= 50}
                  >
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Role Breakdown Setup */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '700' }}>
                    Role-wise Counts (Optional)
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTeamRoles([...teamRoles, { role: 'Helper', count: 1 }]);
                    }}
                  >
                    <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '700' }}>+ Add Role</Text>
                  </TouchableOpacity>
                </View>

                {teamRoles.map((roleItem, rIdx) => (
                  <View
                    key={rIdx}
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      alignItems: 'center',
                      backgroundColor: '#161420',
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: '#252136'
                    }}
                  >
                    <TextInput
                      style={{
                        flex: 2,
                        backgroundColor: '#1F1B2E',
                        color: '#FFFFFF',
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: '#373052',
                        fontSize: 13
                      }}
                      placeholder="Role (e.g. Helper, Electrician)"
                      placeholderTextColor="#6B7280"
                      value={roleItem.role}
                      onChangeText={(val) => {
                        const updated = [...teamRoles];
                        updated[rIdx].role = val;
                        setTeamRoles(updated);
                      }}
                    />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(roleItem.count, 10) || 1;
                          if (current > 1) {
                            const updated = [...teamRoles];
                            updated[rIdx].count = current - 1;
                            setTeamRoles(updated);
                          }
                        }}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#2D2845', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="remove" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', minWidth: 20, textAlign: 'center' }}>
                        {roleItem.count}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const current = parseInt(roleItem.count, 10) || 1;
                          const updated = [...teamRoles];
                          updated[rIdx].count = current + 1;
                          setTeamRoles(updated);
                        }}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#2D2845', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    {teamRoles.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          setTeamRoles(teamRoles.filter((_, idx) => idx !== rIdx));
                        }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#F43F5E" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {/* Notes */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
                  Team Notes (Visible to Customer)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#161420',
                    color: '#FFFFFF',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#252136',
                    fontSize: 13,
                    minHeight: 48
                  }}
                  placeholder="e.g. Arriving with 1 apprentice for heavy lifting"
                  placeholderTextColor="#6B7280"
                  multiline
                  value={teamNotes}
                  onChangeText={setTeamNotes}
                />
              </View>

              {/* Required Reason if in_progress */}
              {booking.status === 'in_progress' && (
                <View style={{ marginBottom: 16, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}>
                  <Text style={{ color: '#FCD34D', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                    Authorized Change Reason *
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 11, marginBottom: 8 }}>
                    Because the service has already begun, any change in team size must be explicitly recorded in the job history.
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#161420',
                      color: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#F59E0B',
                      fontSize: 13,
                      minHeight: 48
                    }}
                    placeholder="e.g. Customer requested additional specialist to expedite wiring"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={teamReason}
                    onChangeText={setTeamReason}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowTeamModal(false)}
                disabled={teamSubmitting}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <Button
                title={teamSubmitting ? 'Saving...' : 'Confirm Team Size'}
                variant="primary"
                loading={teamSubmitting}
                disabled={teamSubmitting}
                onPress={handleSaveTeamSize}
                style={{ flex: 2 }}
              />
            </View>
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
  scrollContent: {
    padding: spacing.lg
  },
  card: {
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderRadius: 16,
    marginBottom: spacing.md
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  serviceName: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  reference: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '700',
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: '#252136',
    marginVertical: spacing.md
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  metaLabel: {
    ...typography.bodySmall,
    color: '#9CA3AF'
  },
  metaVal: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  price: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    marginBottom: spacing.md
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#201A36',
    borderWidth: 1,
    borderColor: '#362E52',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1
  },
  infoTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  infoSub: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginTop: 2
  },
  notesBox: {
    backgroundColor: '#1C1929',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2A253E',
    marginTop: spacing.xs
  },
  notesHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    marginBottom: 4
  },
  notesBody: {
    ...typography.bodySmall,
    color: '#CBD5E1'
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5
  },
  timelineLabel: {
    ...typography.bodySmall,
    color: '#9CA3AF'
  },
  timelineVal: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '500'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0E16',
    borderTopWidth: 1,
    borderTopColor: '#1F1C2B',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  actionBtn: {
    width: '100%'
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: spacing.xs
  },
  partsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  partsBreakdownBox: {
    marginTop: spacing.xs
  },
  partItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#201C30'
  },
  partItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F3F4F6'
  },
  partItemDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  partItemMeta: {
    fontSize: 11,
    color: '#A78BFA',
    marginTop: 2
  },
  partItemNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6B7280',
    marginTop: 2
  },
  partItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8
  },
  partsDivider: {
    height: 1,
    backgroundColor: '#252136',
    marginVertical: spacing.sm
  },
  partsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  partsSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  partsSummaryVal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E5E7EB'
  },
  partsSummaryTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA'
  },
  partsSummaryTotalVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A78BFA'
  },
  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#311018',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm
  },
  rejectionText: {
    fontSize: 11,
    color: '#FDA4AF',
    flex: 1
  },
  approvedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#062E1F',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm
  },
  approvedText: {
    fontSize: 11,
    color: '#6EE7B7',
    flex: 1
  },
  noPartsText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: spacing.sm
  },
  addPartsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#7C3AED',
    backgroundColor: '#1E1238',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.md
  },
  addPartsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA'
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
    padding: spacing.md,
    zIndex: 999
  },
  modalContainer: {
    backgroundColor: '#161420',
    width: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A253E',
    overflow: 'hidden'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
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
    padding: spacing.md
  },
  emptyPartsModalBox: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md
  },
  emptyPartsModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EDE9FE',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center'
  },
  emptyPartsModalText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    textAlign: 'center'
  },
  partCardInput: {
    backgroundColor: '#1C1929',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2D2845',
    marginBottom: spacing.md
  },
  partCardInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  partCardIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA'
  },
  removePartBtn: {
    padding: 4
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 4
  },
  inputField: {
    backgroundColor: '#0F0E16',
    borderWidth: 1,
    borderColor: '#2F2947',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 13
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#262238'
  },
  lineTotalLabel: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  lineTotalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399'
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#1E1430',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#3D2F66',
    marginBottom: spacing.md
  },
  addAnotherText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA'
  },
  estimateBox: {
    backgroundColor: '#12101C',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#26213B',
    marginBottom: spacing.sm
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  estimateLabel: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  estimateVal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF'
  },
  estimateDivider: {
    height: 1,
    backgroundColor: '#26213B',
    marginVertical: 6
  },
  estimateTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA'
  },
  estimateTotalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#34D399'
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#252136',
    gap: spacing.md
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#362E52'
  },
  cancelModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF'
  }
});
