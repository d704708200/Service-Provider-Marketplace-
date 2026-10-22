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

// Helpers for Booking Confirmed view
const formatScheduledDate = (rawDate) => {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return String(rawDate);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
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
  if (m === 'online') return { label: 'Online Payment', icon: 'card-outline' };
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

  // Load service & provider data if missing or ensure provider services are loaded
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
            setServiceLoadError(null);
          }
        } catch (err) {
          if (isMounted) setServiceLoadError('Unable to load service information');
        } finally {
          if (isMounted) setLoadingService(false);
        }
      }

      // Case 2: Provider passed or providerId passed
      const rawTargetProviderId = initialProvider?._id || providerId || initialService?.provider?._id || (typeof initialService?.provider === 'string' ? initialService.provider : null);
      const targetProviderId = rawTargetProviderId && String(rawTargetProviderId) !== 'undefined' && String(rawTargetProviderId) !== 'null' ? String(rawTargetProviderId) : null;

      if (targetProviderId) {
        try {
          const pRes = await providerApi.getById(targetProviderId);
          if (isMounted && pRes?.data) {
            const providerData = pRes.data;
            if (!currentProvider) setCurrentProvider(providerData);

            // Display ONLY the selected provider's real services from their saved service catalog
            const allServices = Array.isArray(providerData.services) ? providerData.services : [];
            const providerUserId = providerData.user?._id || providerData.user;
            const ownServices = allServices.filter(
              (s) => s && s.provider && (
                String(s.provider._id || s.provider) === String(targetProviderId) ||
                (providerUserId && String(s.provider._id || s.provider) === String(providerUserId))
              )
            );

            // If provider has configured custom services, use strictly their real services.
            // If provider has zero custom services, fallback to the provider's active catalog services.
            const realServices = (ownServices.length > 0 ? ownServices : allServices)
              .filter((s) => s && s._id && s.isActive !== false);

            setProviderServices(realServices);

            // Safe diagnostic log (no secrets/tokens)
            console.log('[Diagnostic: RequestServiceScreen]', {
              providerId: targetProviderId,
              providerBusinessName: providerData.businessName,
              servicesCount: realServices.length,
              services: realServices.map((s) => ({
                id: s._id,
                name: s.name,
                category: s.category?.name || s.category,
                price: s.price !== undefined ? s.price : s.basePrice
              }))
            });

            // If we still don't have a service selected:
            if (!currentService && !serviceId) {
              if (realServices.length === 1) {
                setCurrentService(realServices[0]);
                setServiceLoadError(null);
              } else if (realServices.length === 0) {
                setServiceLoadError('This provider currently has no available services.');
              }
            } else if (currentService) {
              // If the customer came with a pre-selected service, check if it's in this provider's catalog
              const matchedService = realServices.find(s => String(s._id) === String(currentService._id));
              if (matchedService) {
                // Ensure we use the provider's exact configured service data (pricing, duration, etc.)
                setCurrentService(matchedService);
                setServiceLoadError(null);
              } else if (realServices.length === 1) {
                // If only 1 service is offered by this provider, select it
                setCurrentService(realServices[0]);
                setServiceLoadError(null);
              } else if (realServices.length > 1) {
                // Provider offers multiple services; customer must choose from the provider's real services
                setCurrentService(null);
                setServiceLoadError('Please select one of the provider’s services below.');
              } else if (realServices.length === 0) {
                setCurrentService(null);
                setServiceLoadError('This provider currently has no available services.');
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
  const rawBase = Number(currentService?.price !== undefined ? currentService.price : currentService?.basePrice);
  const effectiveBasePrice = !isNaN(rawBase) && rawBase >= 0 ? rawBase : 0;
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
  const [copiedRef, setCopiedRef] = useState(false);

  const handleCopyReference = async (ref) => {
    if (!ref) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ref);
      }
    } catch (e) {
      // ignore
    }
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // Busy worker detection & alternative worker suggestions state
  const [availabilityStatus, setAvailabilityStatus] = useState(null); // 'available' | 'busy' | 'unavailable' | null
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [busyReason, setBusyReason] = useState(null);
  const [alternativeProviders, setAlternativeProviders] = useState([]);

  // Check provider slot availability whenever selectedDate, startTime, endTime, or provider changes
  React.useEffect(() => {
    let isMounted = true;
    const rawTargetProviderId = currentProvider?._id || providerId || currentService?.provider?._id || (typeof currentService?.provider === 'string' ? currentService.provider : null);
    const targetProviderId = rawTargetProviderId && String(rawTargetProviderId).trim() !== '' && String(rawTargetProviderId) !== 'undefined' && String(rawTargetProviderId) !== 'null' ? String(rawTargetProviderId) : null;

    if (!targetProviderId || bookingMode !== 'scheduled' || !selectedDate || !startTime || !endTime) {
      setAvailabilityStatus(null);
      setAlternativeProviders([]);
      setBusyReason(null);
      setCheckingAvailability(false);
      return;
    }

    async function checkSlot() {
      setCheckingAvailability(true);
      try {
        const res = await providerApi.checkSlotAvailability(targetProviderId, {
          date: selectedDate,
          startTime,
          endTime,
          serviceId: currentService?._id || serviceId
        });
        if (isMounted && res?.data) {
          const { isAvailable, status, reason, alternativeProviders: alts } = res.data;
          setAvailabilityStatus(status || (isAvailable ? 'available' : 'busy'));
          setBusyReason(reason || null);
          setAlternativeProviders(Array.isArray(alts) ? alts : []);
        }
      } catch (err) {
        console.warn('Slot availability check failed:', err.message);
        if (isMounted) {
          setAvailabilityStatus('unavailable');
          setBusyReason('Availability could not be verified. Please check your network connection or try another slot.');
          setAlternativeProviders([]);
        }
      } finally {
        if (isMounted) {
          setCheckingAvailability(false);
        }
      }
    }

    checkSlot();

    return () => {
      isMounted = false;
    };
  }, [currentProvider?._id, providerId, bookingMode, selectedDate, startTime, endTime, currentService?._id, serviceId]);

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

    if (bookingMode === 'scheduled' && availabilityStatus === 'busy') {
      Alert.alert(
        'Provider Busy / Not Available',
        busyReason || 'The selected provider already has a booking during this time. Please select another time or an alternative provider.'
      );
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
        providerId: currentProvider?._id || providerId || currentService?.provider?._id || (typeof currentService?.provider === 'string' ? currentService.provider : undefined),
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

  // If booking is successfully confirmed, show the Redesigned Confirmation View
  if (confirmedBooking) {
    const bookingRef = confirmedBooking.bookingReference || 'N/A';
    const serviceName = confirmedBooking.service?.name || currentService?.name || 'Selected Service';
    const providerName =
      confirmedBooking.provider?.businessName ||
      confirmedBooking.provider?.user?.name ||
      currentProvider?.businessName ||
      'Service Provider';
    const isInstant = confirmedBooking.bookingMode === 'instant';
    const totalAmount = Number(confirmedBooking.pricing?.totalAmount ?? effectiveTotal ?? 0);
    const paymentStatusBadge = getPaymentStatusBadge(confirmedBooking.paymentStatus);
    const bookingStatusBadge = getBookingStatusBadge(confirmedBooking.status);
    const paymentMethodInfo = getPaymentMethodDisplay(confirmedBooking.paymentMethod || paymentMethod);
    const formattedAddress = formatAddress(confirmedBooking.address || { street, city, state, zipCode: postalCode });
    const formattedDate = formatScheduledDate(confirmedBooking.scheduledDate || selectedDate);
    const slotTimes = confirmedBooking.scheduledTimeSlot || (startTime && endTime ? { startTime, endTime } : null);

    return (
      <View style={[styles.confirmContainer, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={[
            styles.confirmScrollContent,
            { paddingBottom: insets.bottom + spacing.xl }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Centered Success Header with glowing halo */}
          <View style={styles.successHeader}>
            <View style={styles.successIconHalo}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-sharp" size={44} color="#10B981" />
              </View>
            </View>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSubtitle}>
              Your service request has been successfully placed with {providerName}.
            </Text>
          </View>

          {/* Dedicated Booking Reference Row with Copy Action */}
          <View style={styles.refBanner}>
            <View style={styles.refInfoCol}>
              <Text style={styles.refLabelText}>BOOKING REFERENCE</Text>
              <Text style={styles.refCodeText} selectable numberOfLines={1}>
                {bookingRef}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.copyButton, copiedRef && styles.copyButtonActive]}
              onPress={() => handleCopyReference(bookingRef)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={copiedRef ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copiedRef ? '#34D399' : '#A78BFA'}
              />
              <Text style={[styles.copyButtonText, copiedRef && styles.copyButtonTextActive]}>
                {copiedRef ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Main Details Card */}
          <Card style={styles.confirmCard} bordered={true}>
            <Text style={styles.confirmCardSectionHeader}>Booking Details</Text>

            {/* Service */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name="briefcase-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Service</Text>
              </View>
              <View style={styles.confirmValueWrap}>
                <Text style={styles.confirmValueBold}>{serviceName}</Text>
              </View>
            </View>

            {/* Provider */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name="person-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Provider</Text>
              </View>
              <View style={styles.confirmValueWrap}>
                <Text style={styles.confirmValue}>{providerName}</Text>
              </View>
            </View>

            {/* Booking Mode */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name="flash-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Mode</Text>
              </View>
              <Badge
                label={isInstant ? 'Instant (ASAP)' : 'Scheduled'}
                variant={isInstant ? 'warning' : 'primary'}
                size="sm"
              />
            </View>

            {/* Scheduled Date & Time Slot */}
            {!isInstant && (
              <View style={styles.confirmRow}>
                <View style={styles.confirmLabelGroup}>
                  <Ionicons name="calendar-outline" size={15} color="#A78BFA" />
                  <Text style={styles.confirmLabel}>Schedule</Text>
                </View>
                <View style={styles.confirmValueWrap}>
                  <Text style={styles.confirmValue}>
                    {formattedDate}
                    {slotTimes ? ` • ${slotTimes.startTime} - ${slotTimes.endTime}` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Payment Method */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name={paymentMethodInfo.icon} size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Payment Method</Text>
              </View>
              <View style={styles.confirmValueWrap}>
                <Text style={styles.confirmValue}>{paymentMethodInfo.label}</Text>
              </View>
            </View>

            {/* Payment Status */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name="shield-checkmark-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Payment Status</Text>
              </View>
              <Badge
                label={paymentStatusBadge.label}
                variant={paymentStatusBadge.variant}
                size="sm"
              />
            </View>

            {/* Razorpay Transaction ID (if available) */}
            {confirmedBooking.paymentDetails?.razorpayPaymentId && (
              <View style={styles.confirmRow}>
                <View style={styles.confirmLabelGroup}>
                  <Ionicons name="receipt-outline" size={15} color="#A78BFA" />
                  <Text style={styles.confirmLabel}>Transaction ID</Text>
                </View>
                <View style={styles.confirmValueWrap}>
                  <Text style={styles.confirmMonoValue}>
                    {confirmedBooking.paymentDetails.razorpayPaymentId}
                  </Text>
                </View>
              </View>
            )}

            {/* Request Status */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmLabelGroup}>
                <Ionicons name="information-circle-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Request Status</Text>
              </View>
              <Badge
                label={bookingStatusBadge.label}
                variant={bookingStatusBadge.variant}
                size="sm"
              />
            </View>

            {/* Service Address */}
            <View style={[styles.confirmRow, { alignItems: 'flex-start' }]}>
              <View style={[styles.confirmLabelGroup, { marginTop: 2 }]}>
                <Ionicons name="location-outline" size={15} color="#A78BFA" />
                <Text style={styles.confirmLabel}>Address</Text>
              </View>
              <View style={styles.confirmValueWrap}>
                <Text style={styles.confirmValue}>{formattedAddress}</Text>
              </View>
            </View>

            {/* Order Total Box */}
            <View style={styles.confirmTotalBox}>
              <View>
                <Text style={styles.confirmTotalLabel}>Total Amount</Text>
                <Text style={styles.confirmTotalSub}>Inclusive of taxes & charges</Text>
              </View>
              <Text style={styles.confirmTotalAmount}>₹{totalAmount.toLocaleString('en-IN')}</Text>
            </View>

            {/* Service Team Section */}
            <View style={styles.confirmTeamSection}>
              <View style={styles.confirmTeamHeader}>
                <View style={styles.confirmTeamHeaderLeft}>
                  <Ionicons name="people" size={16} color="#A78BFA" />
                  <Text style={styles.confirmTeamTitle}>Service Team Allocation</Text>
                </View>
                <Badge
                  label={confirmedBooking.serviceTeam?.isConfirmed ? 'CONFIRMED' : 'AWAITING CONFIRMATION'}
                  variant={confirmedBooking.serviceTeam?.isConfirmed ? 'success' : 'warning'}
                  size="sm"
                />
              </View>

              {confirmedBooking.serviceTeam?.isConfirmed && confirmedBooking.serviceTeam?.totalCount ? (
                <View style={styles.teamConfirmedBox}>
                  <Text style={styles.teamConfirmedTitle}>
                    {confirmedBooking.serviceTeam.totalCount === 1
                      ? '1 Dedicated Specialist Assigned'
                      : `${confirmedBooking.serviceTeam.totalCount} Dedicated Specialists Assigned`}
                  </Text>
                  {Array.isArray(confirmedBooking.serviceTeam.roles) && confirmedBooking.serviceTeam.roles.length > 0 && (
                    <View style={styles.teamRolesWrap}>
                      {confirmedBooking.serviceTeam.roles.map((r, idx) => (
                        <View key={idx} style={styles.teamRolePill}>
                          <Text style={styles.teamRolePillText}>
                            {r.role}: {r.count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.teamPendingBox}>
                  <Ionicons name="time-outline" size={15} color="#FBBF24" style={{ marginTop: 1 }} />
                  <Text style={styles.teamPendingText}>
                    The service provider will confirm their crew size and assigned specialists before commencing service.
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.confirmActions}>
            <Button
              title="View in My Bookings"
              onPress={() => {
                navigation.navigate('MainTabs', { screen: 'BookingsTab' });
              }}
              variant="primary"
              size="lg"
              leftIcon="calendar-outline"
              style={styles.confirmPrimaryBtn}
            />

            <Button
              title="Back to Home"
              onPress={() => {
                navigation.navigate('MainTabs', { screen: 'HomeTab' });
              }}
              variant="outline"
              size="lg"
              leftIcon="home-outline"
              style={styles.confirmSecondaryBtn}
            />
          </View>
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

        {/* Provider Services Selection (if provider has services to pick from) */}
        {providerServices.length > 0 && (
          <Card style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.sectionTitleNoMargin}>Select Service from Provider</Text>
              <Badge
                label={currentService ? 'Selected' : 'Required'}
                variant={currentService ? 'success' : 'warning'}
                size="sm"
              />
            </View>
            <Text style={{ ...typography.caption, color: colors.slate500, marginBottom: 10 }}>
              Pick the specific service you need this provider to perform:
            </Text>
            <View style={{ gap: 8 }}>
              {providerServices.map((ps) => {
                const isSelected = String(currentService?._id) === String(ps._id);
                const rawPrice = Number(ps.price !== undefined ? ps.price : ps.basePrice);
                const psPrice = !isNaN(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
                const categoryName = ps.category?.name || (typeof ps.category === 'string' && ps.category.trim() ? ps.category : 'General Service');
                const duration = ps.estimatedDurationMinutes || ps.duration;
                return (
                  <TouchableOpacity
                    key={ps._id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.08)' : colors.card,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.primary : colors.slate200
                    }}
                    onPress={() => {
                      setCurrentService(ps);
                      setServiceLoadError(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ ...typography.bodyMedium, fontWeight: isSelected ? '700' : '600', color: isSelected ? colors.primaryDark : colors.slate900 }}>
                        {ps.name}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.slate500, marginTop: 2 }}>
                        {categoryName}{duration ? ` • ${duration} mins` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isSelected ? colors.primaryDark : colors.slate900 }}>
                        ₹{psPrice.toLocaleString('en-IN')}
                      </Text>
                      {isSelected && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Selected</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Selected Service Card */}
        {currentService ? (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Selected Service</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>{currentService.name}</Text>
                <Text style={styles.summarySub}>
                  {currentService.category?.name || (typeof currentService.category === 'string' && currentService.category.trim() ? currentService.category : 'General')}
                </Text>
              </View>
              <View style={styles.summaryPriceCol}>
                <Text style={styles.summaryPrice}>
                  ₹{effectiveBasePrice.toLocaleString('en-IN')}
                </Text>
                <Badge
                  label={PRICING_LABELS[currentService.pricingType || currentService.priceType] || currentService.pricingType || currentService.priceType || 'Fixed'}
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
              <Text style={{ ...typography.bodyMedium, color: '#B91C1C', fontWeight: '600', flex: 1 }}>
                {loadingService
                  ? 'Loading service details...'
                  : serviceLoadError || (providerServices.length > 0 ? 'Please choose one of the provider services above to proceed.' : 'No service selected. Please pick a service to proceed.')}
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

            {/* Provider Slot Availability Status Banner */}
            {(currentProvider || providerId) && (
              <View style={styles.slotAvailabilityBox}>
                {checkingAvailability ? (
                  <View style={styles.availabilityLoadingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.availabilityLoadingText}>Checking provider schedule for this time...</Text>
                  </View>
                ) : availabilityStatus === 'available' ? (
                  <View style={styles.availableBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.availableBannerTitle}>Available at selected time</Text>
                      <Text style={styles.availableBannerSub}>
                        {currentProvider?.businessName || 'Provider'} is free and ready to accept your booking for this time window.
                      </Text>
                    </View>
                  </View>
                ) : availabilityStatus === 'busy' ? (
                  <View style={styles.busyBanner}>
                    <Ionicons name="time" size={18} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.busyBannerTitle}>Busy / Not Available</Text>
                      <Text style={styles.busyBannerSub}>
                        {busyReason || `${currentProvider?.businessName || 'The selected provider'} already has a booking during this time.`}
                      </Text>
                    </View>
                  </View>
                ) : availabilityStatus === 'unavailable' ? (
                  <View style={styles.unavailableBanner}>
                    <Ionicons name="information-circle" size={18} color="#6B7280" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unavailableBannerTitle}>Availability could not be verified</Text>
                      <Text style={styles.unavailableBannerSub}>{busyReason || 'Availability could not be verified.'}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}

            {/* Same-Category Alternative Providers Suggestion Box */}
            {availabilityStatus === 'busy' && (
              <View style={styles.alternativesSection}>
                <View style={styles.alternativesHeaderRow}>
                  <Ionicons name="people" size={16} color="#7C3AED" />
                  <Text style={styles.alternativesHeaderTitle}>
                    Available {currentProvider?.categories?.[0]?.name || currentService?.category?.name || 'Category'} Specialists at this Time
                  </Text>
                </View>

                {alternativeProviders.length > 0 ? (
                  <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                    <Text style={styles.alternativesIntroText}>
                      We found other verified professionals in the exact same category who are free right now:
                    </Text>
                    {alternativeProviders.map((alt) => (
                      <View key={alt._id} style={styles.altCard}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.altName} numberOfLines={1}>
                              {alt.businessName}
                            </Text>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          </View>
                          <Text style={styles.altSub} numberOfLines={1}>
                            ⭐ {alt.rating?.average?.toFixed(1) || '5.0'} • {alt.experienceYears || 1} yrs exp
                            {alt.startingPrice ? ` • Starts ₹${alt.startingPrice}` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.switchWorkerBtn}
                          onPress={() => {
                            // Switch selected provider to this alternative
                            setCurrentProvider(alt);
                            Alert.alert(
                              'Provider Selected',
                              `Switched provider to ${alt.businessName}. You can now proceed with your booking at this time slot!`
                            );
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.switchWorkerBtnText}>Select</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noAlternativesBox}>
                    <Text style={styles.noAlternativesText}>
                      No other verified {currentProvider?.categories?.[0]?.name || 'category'} providers are available for this specific slot.
                    </Text>
                    <Text style={styles.noAlternativesSubText}>
                      Tip: Please try selecting another date or another convenient time window above!
                    </Text>
                  </View>
                )}
              </View>
            )}
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
          <Text style={styles.priceSummaryTitle}>Price Summary</Text>
          <View style={styles.priceSummaryRow}>
            <Text style={styles.confirmKey}>Base Service Price</Text>
            <Text style={styles.confirmVal}>₹{effectiveBasePrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.priceSummaryRow}>
            <Text style={styles.confirmKey}>Platform Convenience Fee</Text>
            <Text style={styles.confirmValFree}>FREE</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceSummaryRow}>
            <Text style={styles.totalPayableLabel}>Total Payable</Text>
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
    backgroundColor: '#1E1A2E',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#362E4F',
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  priceSummaryTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  priceSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7
  },
  confirmKey: {
    fontSize: 14,
    color: '#A7A4BC',
    fontWeight: '500'
  },
  confirmVal: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'right'
  },
  confirmValFree: {
    fontSize: 13,
    fontWeight: '700',
    color: '#34D399',
    textAlign: 'right'
  },
  divider: {
    height: 1,
    backgroundColor: '#312845',
    marginVertical: spacing.sm
  },
  totalPayableLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  confirmValPrice: {
    fontSize: 19,
    fontWeight: '800',
    color: '#A855F7',
    textAlign: 'right'
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
    borderColor: '#2D2845',
    backgroundColor: '#161420'
  },
  paymentOptionCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.12)'
  },
  paymentOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#201A36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3D2F66'
  },
  paymentOptionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: '#E2E8F0'
  },
  paymentOptionTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  paymentOptionSub: {
    ...typography.caption,
    color: '#9CA3AF',
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
  confirmContainer: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  confirmScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center'
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    width: '100%'
  },
  successIconHalo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)'
  },
  successIconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  successTitle: {
    ...typography.titleLarge,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  successSubtitle: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20
  },
  refBanner: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md
  },
  refInfoCol: {
    flex: 1,
    marginRight: spacing.sm
  },
  refLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#A78BFA',
    marginBottom: 2
  },
  refCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.md
  },
  copyButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)'
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA'
  },
  copyButtonTextActive: {
    color: '#34D399'
  },
  confirmCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.lg,
    marginBottom: spacing.lg
  },
  confirmCardSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#A78BFA',
    marginBottom: spacing.md
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#201D2D'
  },
  confirmLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  },
  confirmLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  confirmValueWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: spacing.md
  },
  confirmValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'right',
    lineHeight: 18
  },
  confirmValueBold: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 19
  },
  confirmMonoValue: {
    fontSize: 11,
    color: '#DDD6FE',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right'
  },
  confirmTotalBox: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  confirmTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  confirmTotalSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  confirmTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#34D399'
  },
  confirmTeamSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#252136'
  },
  confirmTeamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  confirmTeamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  confirmTeamTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  teamConfirmedBox: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
    padding: spacing.md,
    borderRadius: borderRadius.md
  },
  teamConfirmedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD6FE'
  },
  teamRolesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs
  },
  teamRolePill: {
    backgroundColor: '#2D1B69',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#7C3AED'
  },
  teamRolePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EDE9FE'
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
  confirmActions: {
    width: '100%',
    maxWidth: 580,
    gap: spacing.sm
  },
  confirmPrimaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: borderRadius.md
  },
  confirmSecondaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderColor: 'rgba(124, 58, 237, 0.5)'
  },
  actionBtn: {
    width: '100%'
  },
  slotAvailabilityBox: {
    marginTop: spacing.sm
  },
  availabilityLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs
  },
  availabilityLoadingText: {
    ...typography.caption,
    color: colors.slate500,
    fontSize: 12
  },
  availableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: borderRadius.md,
    padding: spacing.sm
  },
  availableBannerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#065F46'
  },
  availableBannerSub: {
    ...typography.caption,
    color: '#047857',
    marginTop: 2,
    lineHeight: 16
  },
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: borderRadius.md,
    padding: spacing.sm
  },
  busyBannerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#991B1B'
  },
  busyBannerSub: {
    ...typography.caption,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: spacing.sm
  },
  unavailableBannerTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#374151'
  },
  unavailableBannerSub: {
    ...typography.caption,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16
  },
  alternativesSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100
  },
  alternativesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs
  },
  alternativesHeaderTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: '#6D28D9'
  },
  alternativesIntroText: {
    ...typography.caption,
    color: colors.slate600,
    marginBottom: 4
  },
  altCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: borderRadius.md,
    padding: spacing.sm
  },
  altName: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.slate900
  },
  altSub: {
    ...typography.caption,
    color: colors.slate600,
    marginTop: 2
  },
  switchWorkerBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm
  },
  switchWorkerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  noAlternativesBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  noAlternativesText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.slate700
  },
  noAlternativesSubText: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 4
  }
});
