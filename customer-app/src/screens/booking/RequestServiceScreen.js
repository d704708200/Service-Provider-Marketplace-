import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { bookingApi } from '../../services/api';
import { Header, Card, Input, Button, Badge } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';
import { PRICING_LABELS } from '../../constants';

export default function RequestServiceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { service, provider } = route.params || {};

  // Booking mode: 'scheduled' | 'instant'
  const [bookingMode, setBookingMode] = useState('scheduled');

  // Form states
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [problemDescription, setProblemDescription] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const validate = () => {
    const errors = {};
    if (!street.trim()) errors.street = 'Street address is required';
    if (!city.trim()) errors.city = 'City is required';

    if (bookingMode === 'scheduled') {
      if (!preferredDate.trim()) {
        errors.preferredDate = 'Date is required (YYYY-MM-DD)';
      } else {
        const parsed = new Date(preferredDate.trim());
        if (isNaN(parsed.getTime())) {
          errors.preferredDate = 'Please enter a valid date (YYYY-MM-DD)';
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const checkDate = new Date(parsed);
          checkDate.setHours(23, 59, 59, 999);
          if (checkDate < today) {
            errors.preferredDate = 'Scheduled date cannot be in the past';
          }
        }
      }

      if (!startTime.trim()) errors.startTime = 'Start time required (e.g. 10:00)';
      if (!endTime.trim()) errors.endTime = 'End time required (e.g. 12:00)';
    }

    if (!problemDescription.trim()) {
      errors.problemDescription = 'Please describe the problem or service requirement';
    } else if (problemDescription.trim().length < 10) {
      errors.problemDescription = 'Description must be at least 10 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBookingSubmit = async () => {
    if (!service) {
      Alert.alert('Missing Service', 'Please select a service from the catalog before booking.');
      return;
    }

    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please fix the errors highlighted below.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceId: service._id,
        providerId: provider?._id || undefined,
        bookingMode,
        address: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim() || undefined,
          zipCode: postalCode.trim() || undefined
        },
        notes: problemDescription.trim()
      };

      if (bookingMode === 'scheduled') {
        payload.scheduledDate = preferredDate.trim();
        payload.scheduledTimeSlot = {
          startTime: startTime.trim(),
          endTime: endTime.trim()
        };
      }

      const res = await bookingApi.createBooking(payload);
      if (res?.success && res.data) {
        setConfirmedBooking(res.data);
      } else {
        Alert.alert('Booking Error', 'Could not create booking. Please try again.');
      }
    } catch (err) {
      Alert.alert(
        'Booking Submission Failed',
        err.userMessage || err.message || 'Unable to confirm booking. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // If booking is successfully confirmed, show the Real Confirmation View
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
              <Text style={styles.confirmVal}>{confirmedBooking.service?.name || service?.name}</Text>
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Booking Mode</Text>
              <Badge
                label={confirmedBooking.bookingMode === 'instant' ? 'Instant (ASAP)' : 'Scheduled'}
                variant={confirmedBooking.bookingMode === 'instant' ? 'warning' : 'primary'}
                size="sm"
              />
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Status</Text>
              <Badge label={confirmedBooking.status.toUpperCase()} variant="warning" size="sm" />
            </View>

            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>Base Amount</Text>
              <Text style={styles.confirmValPrice}>
                ₹{confirmedBooking.pricing?.totalAmount?.toLocaleString('en-IN') || service?.basePrice}
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
        subtitle={service?.name || 'Create Booking'}
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

        {/* Selected Service Card */}
        {service && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Selected Service</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>{service.name}</Text>
                <Text style={styles.summarySub}>{service.category?.name || 'General'}</Text>
              </View>
              <View style={styles.summaryPriceCol}>
                <Text style={styles.summaryPrice}>
                  ₹{service.basePrice?.toLocaleString('en-IN') || service.price || 0}
                </Text>
                <Badge
                  label={PRICING_LABELS[service.pricingType] || service.pricingType || 'Fixed'}
                  variant="slate"
                  size="sm"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Selected Provider Card (if specific provider selected) */}
        {provider && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Assigned Provider</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryTitle}>
                  {provider.businessName || provider.user?.name || 'Verified Provider'}
                </Text>
                <Text style={styles.summarySub}>
                  {provider.experienceYears ? `${provider.experienceYears} yrs experience` : 'Verified Partner'}
                </Text>
              </View>
              <Badge label="Verified" variant="success" size="sm" />
            </View>
          </Card>
        )}

        {/* Address Form Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Service Location</Text>

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

        {/* Schedule & Timing Card (shown only for scheduled mode) */}
        {bookingMode === 'scheduled' && (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Scheduled Date & Time Slot</Text>

            <Input
              label="Preferred Date (YYYY-MM-DD) *"
              placeholder="e.g. 2026-10-15"
              value={preferredDate}
              onChangeText={(t) => {
                setPreferredDate(t);
                if (formErrors.preferredDate) setFormErrors({ ...formErrors, preferredDate: null });
              }}
              leftIcon="calendar-outline"
              error={formErrors.preferredDate}
            />

            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Input
                  label="Start Time *"
                  placeholder="10:00"
                  value={startTime}
                  onChangeText={(t) => {
                    setStartTime(t);
                    if (formErrors.startTime) setFormErrors({ ...formErrors, startTime: null });
                  }}
                  leftIcon="time-outline"
                  error={formErrors.startTime}
                />
              </View>
              <View style={styles.halfCol}>
                <Input
                  label="End Time *"
                  placeholder="12:00"
                  value={endTime}
                  onChangeText={(t) => {
                    setEndTime(t);
                    if (formErrors.endTime) setFormErrors({ ...formErrors, endTime: null });
                  }}
                  leftIcon="time-outline"
                  error={formErrors.endTime}
                />
              </View>
            </View>
          </Card>
        )}

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
            numberOfLines={4}
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

        {/* Submit Booking Button */}
        <Button
          title={
            submitting
              ? 'Creating Booking...'
              : bookingMode === 'instant'
              ? 'Request Instant Booking Now'
              : 'Confirm Scheduled Booking'
          }
          onPress={handleBookingSubmit}
          loading={submitting}
          disabled={submitting}
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
