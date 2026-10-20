import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { bookingApi, customerApi, serviceApi, providerApi } from '../../services/api';
import { openRazorpayCheckout } from '../../services/razorpayService';
import { Header, Card, Input, Button, Badge } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';
import { PRICING_LABELS } from '../../constants';

// Pre-defined convenient time slots
const TIME_SLOTS = [
  { startTime: '09:00', endTime: '11:00', label: '09:00 AM - 11:00 AM (Morning)' },
  { startTime: '11:00', endTime: '13:00', label: '11:00 AM - 01:00 PM (Midday)' },
  { startTime: '14:00', endTime: '16:00', label: '02:00 PM - 04:00 PM (Afternoon)' },
  { startTime: '16:00', endTime: '18:00', label: '04:00 PM - 06:00 PM (Evening)' },
  { startTime: '18:00', endTime: '20:00', label: '06:00 PM - 08:00 PM (Night)' }
];

export default function RequestServiceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { service: initialService, serviceId, provider: initialProvider, providerId } = route.params || {};

  // Resolved service & provider states
  const [currentService, setCurrentService] = useState(initialService || null);
  const [currentProvider, setCurrentProvider] = useState(initialProvider || null);
  const [providerServices, setProviderServices] = useState([]);
  const [loadingService, setLoadingService] = useState(false);
  const [serviceLoadError, setServiceLoadError] = useState(null);

  // Booking mode: 'scheduled' | 'instant'
  const [bookingMode, setBookingMode] = useState('scheduled');

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  // Address inputs
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Scheduled date selection - generate dates starting from today in local timezone
  const selectableDates = React.useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${day}`;
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      list.push({ iso, dayName, dayNum, monthName });
    }
    return list;
  }, []);

  const [selectedDate, setSelectedDate] = useState(selectableDates[1]?.iso || selectableDates[0]?.iso);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [startTime, setStartTime] = useState(TIME_SLOTS[0].startTime);
  const [endTime, setEndTime] = useState(TIME_SLOTS[0].endTime);

  // Load service & provider data if missing
  React.useEffect(() => {
    let isMounted = true;

    async function resolveServiceData() {
      // Case 1: Service is missing but serviceId provided
      if (!currentService && serviceId) {
        setLoadingService(true);
        try {
          const res = await serviceApi.getById(serviceId);
          if (isMounted && res?.data) {
            setCurrentService(res.data);
          }
        } catch (err) {
          if (isMounted) setServiceLoadError('Unable to load service information');
        } finally {
          if (isMounted) setLoadingService(false);
        }
      }

      // Case 2: Provider passed or providerId passed
      const targetProviderId = initialProvider?._id || providerId;
      if (targetProviderId) {
        try {
          const pRes = await providerApi.getById(targetProviderId);
          if (isMounted && pRes?.data) {
            if (!currentProvider) setCurrentProvider(pRes.data);
            if (Array.isArray(pRes.data.services) && pRes.data.services.length > 0) {
              setProviderServices(pRes.data.services);
              // Auto-select first service if none selected
              if (!currentService) {
                setCurrentService(pRes.data.services[0]);
              }
            }
          }
        } catch (err) {
          console.warn('Could not load provider services:', err.message);
        }
      }
    }

    resolveServiceData();
    return () => {
      isMounted = false;
    };
  }, [serviceId, providerId, initialProvider]);

  // Pricing calculations
  const effectiveBasePrice = Number(currentService?.basePrice || currentService?.price || 0);
  const effectiveTotal = effectiveBasePrice;

  // Details
  const [problemDescription, setProblemDescription] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');

  // Payment method: 'online' | 'cash'
  const [paymentMethod, setPaymentMethod] = useState('online');

  // Status & submission states
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [paymentFailedNotice, setPaymentFailedNotice] = useState(null);

  // Load saved addresses on screen mount
  React.useEffect(() => {
    let isMounted = true;
    customerApi
      .getAddresses()
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setSavedAddresses(res.data);
          const defaultAddr = res.data.find((a) => a.isDefault) || res.data[0];
          setSelectedAddressId(defaultAddr._id);
          setStreet(defaultAddr.street || '');
          setCity(defaultAddr.city || '');
          setState(defaultAddr.state || '');
          setPostalCode(defaultAddr.zipCode || '');
        } else if (isMounted) {
          setUseCustomAddress(true);
        }
      })
      .catch((err) => {
        console.warn('Could not load saved addresses:', err.message);
        if (isMounted) setUseCustomAddress(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectSavedAddress = (addr) => {
    setSelectedAddressId(addr._id);
    setUseCustomAddress(false);
    setStreet(addr.street || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setPostalCode(addr.zipCode || '');
    if (formErrors.street || formErrors.city) {
      setFormErrors({ ...formErrors, street: null, city: null });
    }
  };

  const handleSelectNewAddressMode = () => {
    setSelectedAddressId(null);
    setUseCustomAddress(true);
    setStreet('');
    setCity('');
    setState('');
    setPostalCode('');
  };

  const validate = () => {
    const errors = {};
    if (!street.trim()) errors.street = 'Street address is required';
    if (!city.trim()) errors.city = 'City is required';

    if (bookingMode === 'scheduled') {
      if (!selectedDate) {
        errors.selectedDate = 'Please select a service date';
      } else {
        const parsed = new Date(selectedDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const check = new Date(parsed);
        check.setHours(23, 59, 59, 999);
        if (check < today) {
          errors.selectedDate = 'Scheduled date cannot be in the past';
        }
      }

      if (!startTime || !endTime) {
        errors.timeSlot = 'Please select a valid time slot';
      } else {
        // Validate end time is after start time
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        if (endMinutes <= startMinutes) {
          errors.timeSlot = 'End time must be later than start time';
        }
      }
    }

    if (!problemDescription.trim()) {
      errors.problemDescription = 'Please describe the problem or service requirement';
    } else if (problemDescription.trim().length < 10) {
      errors.problemDescription = 'Description must be at least 10 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Loads Razorpay checkout script dynamically on Expo Web
   */
  /**
   * Main submission handler: Creates booking, then opens native/web Razorpay checkout if online
   */
  const handleBookingSubmit = async () => {
    if (!currentService || !currentService._id) {
      Alert.alert('Missing Service', 'Please select a valid service before booking.');
      return;
    }

    if (effectiveBasePrice <= 0) {
      Alert.alert('Invalid Service Price', 'This service has an invalid price configuration. Please choose another service.');
      return;
    }

    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please fix the errors highlighted below.');
      return;
    }

    setSubmitting(true);
    setPaymentFailedNotice(null);

    try {
      const payload = {
        serviceId: currentService._id,
        providerId: currentProvider?._id || undefined,
        bookingMode,
        paymentMethod,
        address: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim() || undefined,
          zipCode: postalCode.trim() || undefined
        },
        notes: problemDescription.trim()
      };

      if (bookingMode === 'scheduled') {
        payload.scheduledDate = selectedDate;
        payload.scheduledTimeSlot = {
          startTime: startTime.trim(),
          endTime: endTime.trim()
        };
      }

      // Step 1: Create server-side booking record
      const res = await bookingApi.createBooking(payload);
      if (!res?.success || !res.data) {
        Alert.alert('Booking Error', 'Could not create booking. Please try again.');
        setSubmitting(false);
        return;
      }

      const createdBooking = res.data;

      // Step 2: Handle Cash payment vs Online Razorpay payment
      if (paymentMethod === 'cash') {
        setConfirmedBooking(createdBooking);
        setSubmitting(false);
        return;
      }

      // Step 3: Online Payment via Razorpay
      setPaymentProcessing(true);
      try {
        const orderRes = await bookingApi.createPaymentOrder(createdBooking._id);
        if (!orderRes?.success || !orderRes.data) {
          Alert.alert('Payment Order Error', 'Could not create payment order. Booking saved as pending.');
          setConfirmedBooking(createdBooking);
          return;
        }

        const checkoutResult = await openRazorpayCheckout({
          orderData: orderRes.data,
          description: `${currentService?.name || 'Service Booking'} (${orderRes.data.bookingReference || ''})`,
          customerName: user?.name || orderRes.data.customer?.name || 'Customer',
          customerPhone: contactPhone || user?.phone || orderRes.data.customer?.phone || '',
          customerEmail: user?.email || '',
          themeColor: '#7C3AED'
        });

        if (checkoutResult.success && checkoutResult.data) {
          // Verify signature on backend before confirming booking as paid
          try {
            const verifyRes = await bookingApi.verifyPayment(createdBooking._id, {
              razorpayOrderId: checkoutResult.data.razorpayOrderId,
              razorpayPaymentId: checkoutResult.data.razorpayPaymentId,
              razorpaySignature: checkoutResult.data.razorpaySignature
            });

            if (verifyRes?.success && verifyRes.data) {
              setConfirmedBooking(verifyRes.data);
            } else {
              Alert.alert(
                'Verification Issue',
                'Payment was completed but verification failed. Your booking is saved as pending.'
              );
              setConfirmedBooking(createdBooking);
            }
          } catch (verifyErr) {
            Alert.alert(
              'Payment Verification Failed',
              verifyErr.userMessage || verifyErr.message || 'Payment signature could not be verified.'
            );
            setConfirmedBooking(createdBooking);
          }
        } else {
          // User cancelled or payment failed
          const isCancelled = checkoutResult.error?.isCancelled;
          const failureMsg = checkoutResult.error?.description || (isCancelled ? 'Payment cancelled' : 'Payment failed');
          setPaymentFailedNotice(failureMsg);

          try {
            await bookingApi.recordPaymentFailure(createdBooking._id, failureMsg);
          } catch (e) {
            // ignore failure recording error
          }

          if (isCancelled) {
            Alert.alert(
              'Payment Cancelled',
              'You cancelled the online payment. Your booking has been saved. You can pay on arrival or retry payment later.',
              [
                {
                  text: 'View Booking',
                  onPress: () => setConfirmedBooking(createdBooking)
                }
              ]
            );
          } else {
            Alert.alert(
              'Payment Failed',
              `${failureMsg}. Your booking is saved as pending.`,
              [
                {
                  text: 'View Booking',
                  onPress: () => setConfirmedBooking(createdBooking)
                }
              ]
            );
          }
        }
      } catch (err) {
        Alert.alert(
          'Payment Initiation Notice',
          err.userMessage || err.message || 'Could not initiate online payment. Booking saved as pending.'
        );
        setConfirmedBooking(createdBooking);
      } finally {
        setPaymentProcessing(false);
        setSubmitting(false);
      }
    } catch (err) {
      Alert.alert(
        'Booking Submission Failed',
        err.userMessage || err.message || 'Unable to confirm booking. Please try again.'
      );
      setSubmitting(false);
    }
  };

  // If booking is successfully confirmed, show the Confirmation View
  if (confirmedBooking) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + spacing.xxl }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successHeader}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your service request has been successfully created on the marketplace.
            </Text>
          </View>

          <Card style={styles.confirmCard}>
            <View style={styles.confirmRefRow}>
              <Text style={styles.confirmRefLabel}>Booking Reference</Text>
              <Text style={styles.confirmRefValue}>{confirmedBooking.bookingReference}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Service</Text>
              <Text style={styles.confirmVal}>{confirmedBooking.service?.name || currentService?.name}</Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Booking Mode</Text>
              <Badge
                label={confirmedBooking.bookingMode === 'instant' ? 'Instant (ASAP)' : 'Scheduled'}
                variant={confirmedBooking.bookingMode === 'instant' ? 'warning' : 'primary'}
                size="sm"
              />
            </View>

            {confirmedBooking.bookingMode === 'scheduled' && (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Scheduled Time</Text>
                <Text style={styles.confirmVal}>
                  {new Date(confirmedBooking.scheduledDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}{' '}
                  ({confirmedBooking.scheduledTimeSlot?.startTime} - {confirmedBooking.scheduledTimeSlot?.endTime})
                </Text>
              </View>
            )}

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Payment Method</Text>
              <Text style={[styles.confirmVal, { textTransform: 'uppercase', fontWeight: '700' }]}>
                {confirmedBooking.paymentMethod || paymentMethod}
              </Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Payment Status</Text>
              <Badge
                label={confirmedBooking.paymentStatus?.toUpperCase() || 'PENDING'}
                variant={confirmedBooking.paymentStatus === 'paid' ? 'success' : 'warning'}
                size="sm"
              />
            </View>

            {confirmedBooking.paymentDetails?.razorpayPaymentId && (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmKey}>Payment ID</Text>
                <Text style={[styles.confirmVal, { fontFamily: 'monospace', fontSize: 11 }]}>
                  {confirmedBooking.paymentDetails.razorpayPaymentId}
                </Text>
              </View>
            )}

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Status</Text>
              <Badge label={confirmedBooking.status.toUpperCase()} variant="warning" size="sm" />
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Order Total</Text>
              <Text style={styles.confirmValPrice}>
                ₹{(confirmedBooking.pricing?.totalAmount || effectiveTotal).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Service Address</Text>
              <Text style={styles.confirmVal} numberOfLines={2}>
                {confirmedBooking.address?.street}, {confirmedBooking.address?.city}
              </Text>
            </View>
          </Card>

          <Button
            title="View in My Bookings"
            onPress={() => {
              navigation.navigate('MainTabs', { screen: 'BookingsTab' });
            }}
            variant="primary"
            style={styles.actionBtn}
          />

          <Button
            title="Back to Home"
            onPress={() => {
              navigation.navigate('MainTabs', { screen: 'HomeTab' });
            }}
            variant="outline"
            style={[styles.actionBtn, { marginTop: spacing.sm }]}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Request Service"
        subtitle={currentService?.name || 'Create Booking'}
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Mode Selector */}
        <Card style={styles.modeCard}>
          <Text style={styles.sectionTitle}>Select Booking Mode</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeTab, bookingMode === 'scheduled' && styles.modeTabActive]}
              onPress={() => setBookingMode('scheduled')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={bookingMode === 'scheduled' ? colors.primary : colors.slate500}
              />
              <Text
                style={[
                  styles.modeTabText,
                  bookingMode === 'scheduled' && styles.modeTabTextActive
                ]}
              >
                Scheduled
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, bookingMode === 'instant' && styles.modeTabActive]}
              onPress={() => setBookingMode('instant')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash-outline"
                size={20}
                color={bookingMode === 'instant' ? colors.warning : colors.slate500}
              />
              <Text
                style={[
                  styles.modeTabText,
                  bookingMode === 'instant' && styles.modeTabTextActive
                ]}
              >
                Instant (ASAP)
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Provider Services Selection (if provider has multiple services or no service chosen yet) */}
        {providerServices.length > 0 && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Select Service from Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
              {providerServices.map((ps) => {
                const isSelected = currentService?._id === ps._id;
                const psPrice = Number(ps.basePrice || ps.price || 0);
                return (
                  <TouchableOpacity
                    key={ps._id}
                    style={[styles.savedAddressChip, isSelected && styles.savedAddressChipSelected]}
                    onPress={() => setCurrentService(ps)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.savedAddressChipTitle, isSelected && styles.savedAddressChipTitleSelected]}>
                      {ps.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? colors.primaryDark : colors.slate700, marginTop: 2 }}>
                      ₹{psPrice.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Card>
        )}

        {/* Selected Service Card */}
        {currentService ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Selected Service</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>{currentService.name}</Text>
                <Text style={styles.summarySub}>{currentService.category?.name || 'General'}</Text>
              </View>
              <View style={styles.summaryPriceCol}>
                <Text style={styles.summaryPrice}>
                  ₹{effectiveBasePrice.toLocaleString('en-IN')}
                </Text>
                <Badge
                  label={PRICING_LABELS[currentService.pricingType] || currentService.pricingType || 'Fixed'}
                  variant="slate"
                  size="sm"
                />
              </View>
            </View>
          </Card>
        ) : (
          <Card style={[styles.summaryCard, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={{ ...typography.bodyMedium, color: '#B91C1C', fontWeight: '600' }}>
                {loadingService ? 'Loading service details...' : serviceLoadError || 'No service selected. Please pick a service to proceed.'}
              </Text>
            </View>
          </Card>
        )}

        {/* Selected Provider Card (if specific provider selected) */}
        {currentProvider && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Assigned Provider</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>
                  {currentProvider.businessName || currentProvider.user?.name || 'Verified Provider'}
                </Text>
                <Text style={styles.summarySub}>
                  {currentProvider.experienceYears ? `${currentProvider.experienceYears} yrs experience` : 'Verified Partner'}
                </Text>
              </View>
              <Badge label="Verified" variant="success" size="sm" />
            </View>
          </Card>
        )}

        {/* Schedule & Interactive Date/Time Slot Selection Card */}
        {bookingMode === 'scheduled' && (
          <Card style={styles.formCard}>
            <View style={styles.cardHeaderWithIcon}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
              <Text style={styles.sectionTitleNoMargin}>Select Preferred Date</Text>
            </View>

            {formErrors.selectedDate && (
              <Text style={styles.errorBannerText}>{formErrors.selectedDate}</Text>
            )}

            {/* Interactive 14-day horizontal calendar chip list */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateChipsScroll}
            >
              {selectableDates.map((item) => {
                const isSelected = selectedDate === item.iso;
                return (
                  <TouchableOpacity
                    key={item.iso}
                    style={[styles.dateChip, isSelected && styles.dateChipActive]}
                    onPress={() => {
                      setSelectedDate(item.iso);
                      if (formErrors.selectedDate) {
                        setFormErrors((prev) => ({ ...prev, selectedDate: null }));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                      {item.dayName}
                    </Text>
                    <Text style={[styles.dateChipNumber, isSelected && styles.dateChipNumberActive]}>
                      {item.dayNum}
                    </Text>
                    <Text style={[styles.dateChipMonth, isSelected && styles.dateChipMonthActive]}>
                      {item.monthName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.cardHeaderWithIcon, { marginTop: spacing.md }]}>
              <Ionicons name="time" size={18} color={colors.primary} />
              <Text style={styles.sectionTitleNoMargin}>Select Time Window</Text>
            </View>

            {formErrors.timeSlot && (
              <Text style={styles.errorBannerText}>{formErrors.timeSlot}</Text>
            )}

            {/* Predefined Time Slots Grid */}
            <View style={styles.timeSlotsGrid}>
              {TIME_SLOTS.map((slot, idx) => {
                const isSelected = selectedSlotIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.timeSlotCard, isSelected && styles.timeSlotCardActive]}
                    onPress={() => {
                      setSelectedSlotIndex(idx);
                      setStartTime(slot.startTime);
                      setEndTime(slot.endTime);
                      if (formErrors.timeSlot) {
                        setFormErrors((prev) => ({ ...prev, timeSlot: null }));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.slotRadioCircle}>
                      {isSelected && <View style={styles.slotRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextActive]}>
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <Text style={styles.timeSlotSubText}>{slot.label.split('(')[1]?.replace(')', '') || ''}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Address Form Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Service Location</Text>

          {/* Saved Addresses Picker */}
          {savedAddresses.length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.subSectionTitle}>Choose from Saved Addresses</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
                {savedAddresses.map((addr) => {
                  const isSelected = selectedAddressId === addr._id && !useCustomAddress;
                  return (
                    <TouchableOpacity
                      key={addr._id}
                      style={[styles.savedAddressChip, isSelected && styles.savedAddressChipSelected]}
                      onPress={() => handleSelectSavedAddress(addr)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons
                          name={addr.title?.toLowerCase() === 'work' ? 'briefcase-outline' : 'home-outline'}
                          size={14}
                          color={isSelected ? colors.primary : colors.slate500}
                        />
                        <Text style={[styles.savedAddressChipTitle, isSelected && styles.savedAddressChipTitleSelected]}>
                          {addr.title || 'Address'}
                        </Text>
                        {addr.isDefault && <Badge label="DEFAULT" variant="primary" size="sm" />}
                      </View>
                      <Text style={styles.savedAddressChipStreet} numberOfLines={1}>
                        {addr.street}, {addr.city}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[styles.savedAddressChip, useCustomAddress && styles.savedAddressChipSelected]}
                  onPress={handleSelectNewAddressMode}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="add-circle-outline" size={14} color={useCustomAddress ? colors.primary : colors.slate500} />
                    <Text style={[styles.savedAddressChipTitle, useCustomAddress && styles.savedAddressChipTitleSelected]}>
                      New Address
                    </Text>
                  </View>
                  <Text style={styles.savedAddressChipStreet} numberOfLines={1}>
                    Enter custom location
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          <Input
            label="Street Address *"
            placeholder="Flat / House No., Street, Area"
            value={street}
            onChangeText={(t) => {
              setStreet(t);
              if (formErrors.street) setFormErrors({ ...formErrors, street: null });
            }}
            error={formErrors.street}
          />

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="City *"
                placeholder="e.g. Mumbai"
                value={city}
                onChangeText={(t) => {
                  setCity(t);
                  if (formErrors.city) setFormErrors({ ...formErrors, city: null });
                }}
                error={formErrors.city}
              />
            </View>
            <View style={styles.halfCol}>
              <Input
                label="State"
                placeholder="e.g. Maharashtra"
                value={state}
                onChangeText={(t) => setState(t)}
              />
            </View>
          </View>

          <Input
            label="Postal Code (PIN)"
            placeholder="e.g. 400001"
            value={postalCode}
            onChangeText={(t) => setPostalCode(t)}
            keyboardType="number-pad"
            maxLength={6}
          />
        </Card>

        {/* Details & Description Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Service Details</Text>

          <Input
            label="Problem Description *"
            placeholder="Describe what needs repair, servicing, or installation..."
            value={problemDescription}
            onChangeText={(t) => {
              setProblemDescription(t);
              if (formErrors.problemDescription) setFormErrors({ ...formErrors, problemDescription: null });
            }}
            multiline
            numberOfLines={3}
            error={formErrors.problemDescription}
          />

          <Input
            label="Contact Mobile"
            placeholder="10-digit mobile number"
            value={contactPhone}
            onChangeText={(t) => setContactPhone(t)}
            keyboardType="phone-pad"
            maxLength={10}
            leftIcon="call-outline"
          />
        </Card>

        {/* Payment Method Selector Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>

          <View style={styles.paymentOptionsContainer}>
            {/* Razorpay Online */}
            <TouchableOpacity
              style={[
                styles.paymentOptionCard,
                paymentMethod === 'online' && styles.paymentOptionCardActive
              ]}
              onPress={() => setPaymentMethod('online')}
              activeOpacity={0.8}
            >
              <View style={styles.paymentOptionIconWrap}>
                <Ionicons name="card" size={20} color={paymentMethod === 'online' ? colors.primary : colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.paymentOptionTitle, paymentMethod === 'online' && styles.paymentOptionTitleActive]}>
                    Pay Online via Razorpay
                  </Text>
                  <Badge label="SECURE" variant="success" size="sm" />
                </View>
                <Text style={styles.paymentOptionSub}>
                  UPI, Cards, Netbanking, Wallets
                </Text>
              </View>
              <View style={styles.slotRadioCircle}>
                {paymentMethod === 'online' && <View style={styles.slotRadioInner} />}
              </View>
            </TouchableOpacity>

            {/* Cash on Delivery */}
            <TouchableOpacity
              style={[
                styles.paymentOptionCard,
                paymentMethod === 'cash' && styles.paymentOptionCardActive
              ]}
              onPress={() => setPaymentMethod('cash')}
              activeOpacity={0.8}
            >
              <View style={styles.paymentOptionIconWrap}>
                <Ionicons name="cash-outline" size={20} color={paymentMethod === 'cash' ? colors.primary : colors.slate500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentOptionTitle, paymentMethod === 'cash' && styles.paymentOptionTitleActive]}>
                  Cash / Pay on Service
                </Text>
                <Text style={styles.paymentOptionSub}>
                  Pay verified professional after work completion
                </Text>
              </View>
              <View style={styles.slotRadioCircle}>
                {paymentMethod === 'cash' && <View style={styles.slotRadioInner} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* Payment Notice */}
          {paymentFailedNotice && (
            <View style={styles.paymentNoticeBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.paymentNoticeText}>{paymentFailedNotice}</Text>
            </View>
          )}
        </Card>

        {/* Pricing Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Price Summary</Text>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>Base Service Price</Text>
            <Text style={styles.confirmVal}>₹{effectiveBasePrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmKey}>Platform Convenience Fee</Text>
            <Text style={styles.confirmVal}>FREE</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.confirmRow}>
            <Text style={[styles.confirmKey, { fontWeight: '700', color: colors.slate900 }]}>Total Payable</Text>
            <Text style={styles.confirmValPrice}>
              ₹{effectiveTotal.toLocaleString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Submit Booking Button */}
        <Button
          title={
            submitting || paymentProcessing
              ? paymentProcessing
                ? 'Opening Razorpay Checkout...'
                : 'Confirming Booking...'
              : !currentService || effectiveBasePrice <= 0
              ? 'Select a Valid Service'
              : paymentMethod === 'online'
              ? `Pay ₹${effectiveTotal.toLocaleString('en-IN')} & Book Service`
              : bookingMode === 'instant'
              ? 'Request Instant Booking (Pay on Service)'
              : 'Confirm Scheduled Booking'
          }
          onPress={handleBookingSubmit}
          loading={submitting || paymentProcessing}
          disabled={submitting || paymentProcessing || !currentService || effectiveBasePrice <= 0}
          style={styles.submitBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.lg
  },
  modeCard: {
    marginBottom: spacing.md
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.slate50
  },
  modeTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle
  },
  modeTabText: {
    ...typography.bodyMedium,
    color: colors.slate600,
    fontWeight: '600'
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  summaryCard: {
    marginBottom: spacing.md
  },
  formCard: {
    marginBottom: spacing.md
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: spacing.md
  },
  sectionTitleNoMargin: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  dateChipsScroll: {
    gap: spacing.sm,
    paddingVertical: 4
  },
  dateChip: {
    width: 64,
    height: 76,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate50,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  dateChipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary
  },
  dateChipDay: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate500,
    textTransform: 'uppercase'
  },
  dateChipDayActive: {
    color: colors.primaryDark
  },
  dateChipNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.slate800,
    marginVertical: 1
  },
  dateChipNumberActive: {
    color: colors.primaryDark
  },
  dateChipMonth: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.slate400
  },
  dateChipMonthActive: {
    color: colors.primary
  },
  timeSlotsGrid: {
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  timeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50
  },
  timeSlotCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle
  },
  timeSlotText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.slate800
  },
  timeSlotTextActive: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  timeSlotSubText: {
    ...typography.caption,
    color: colors.slate500
  },
  slotRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  slotRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.xs
  },
  paymentOptionsContainer: {
    gap: spacing.sm
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50
  },
  paymentOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle
  },
  paymentOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.slate200
  },
  paymentOptionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.slate800
  },
  paymentOptionTitleActive: {
    color: colors.primaryDark,
    fontWeight: '700'
  },
  paymentOptionSub: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2
  },
  paymentNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm
  },
  paymentNoticeText: {
    ...typography.caption,
    color: '#B91C1C',
    flex: 1
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  summaryTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.slate900
  },
  summarySub: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2
  },
  subSectionTitle: {
    ...typography.caption,
    color: colors.slate600,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  savedAddressChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    minWidth: 140
  },
  savedAddressChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle
  },
  savedAddressChipTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.slate800
  },
  savedAddressChipTitleSelected: {
    color: colors.primaryDark
  },
  savedAddressChipStreet: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2
  },
  summaryPriceCol: {
    alignItems: 'flex-end',
    gap: 4
  },
  summaryPrice: {
    ...typography.titleSmall,
    color: colors.primaryDark,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  halfCol: {
    flex: 1
  },
  submitBtn: {
    marginTop: spacing.sm
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.lg
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  successTitle: {
    ...typography.titleLarge,
    color: colors.slate900,
    marginBottom: spacing.xs
  },
  successSubtitle: {
    ...typography.bodyMedium,
    color: colors.slate600,
    textAlign: 'center',
    maxWidth: 290
  },
  confirmCard: {
    marginBottom: spacing.xl
  },
  confirmRefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  confirmRefLabel: {
    ...typography.caption,
    color: colors.slate500,
    textTransform: 'uppercase'
  },
  confirmRefValue: {
    ...typography.titleSmall,
    color: colors.primary,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.md
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  confirmKey: {
    ...typography.bodyMedium,
    color: colors.slate500
  },
  confirmVal: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.slate800,
    textAlign: 'right',
    maxWidth: '60%'
  },
  confirmValPrice: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  actionBtn: {
    width: '100%'
  }
});
