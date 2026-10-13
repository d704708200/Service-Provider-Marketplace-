import React, { useState, useEffect } from 'react';
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
import { Header, Card, Input, Button, Badge } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';
import { PRICING_LABELS } from '../../constants';

export default function RequestServiceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { service, provider } = route.params || {};

  // Form states
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');

  const [formErrors, setFormErrors] = useState({});
  const [preparedPayload, setPreparedPayload] = useState(null);

  const validate = () => {
    const errors = {};
    if (!street.trim()) errors.street = 'Street address is required';
    if (!city.trim()) errors.city = 'City is required';
    if (!state.trim()) errors.state = 'State is required';
    if (!postalCode.trim()) {
      errors.postalCode = 'Postal code is required';
    } else if (!/^\d{6}$/.test(postalCode.trim())) {
      errors.postalCode = 'Enter a valid 6-digit postal code';
    }

    if (!preferredDate.trim()) {
      errors.preferredDate = 'Preferred date is required (e.g. YYYY-MM-DD)';
    }
    if (!preferredTime.trim()) {
      errors.preferredTime = 'Preferred time slot is required (e.g. 10:00 AM)';
    }

    if (!problemDescription.trim()) {
      errors.problemDescription = 'Please describe the problem or service requirement';
    } else if (problemDescription.trim().length < 10) {
      errors.problemDescription = 'Description must be at least 10 characters';
    }

    if (!contactPhone.trim()) {
      errors.contactPhone = 'Contact phone number is required';
    } else if (contactPhone.replace(/\D/g, '').length !== 10) {
      errors.contactPhone = 'Must be a valid 10-digit phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePrepareRequest = () => {
    if (!validate()) {
      Alert.alert('Incomplete Form', 'Please complete all required fields before proceeding.');
      return;
    }

    const payload = {
      service: service ? { id: service._id, name: service.name, basePrice: service.basePrice } : null,
      provider: provider ? { id: provider._id, businessName: provider.businessName || provider.user?.name } : null,
      serviceAddress: {
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim()
      },
      schedule: {
        date: preferredDate.trim(),
        timeSlot: preferredTime.trim()
      },
      problemDescription: problemDescription.trim(),
      customerContact: {
        name: user?.name,
        phone: contactPhone.trim(),
        email: user?.email
      },
      createdAt: new Date().toISOString()
    };

    setPreparedPayload(payload);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Request Service"
        subtitle="Booking Preparation"
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Architecture Staging Phase Notice */}
        <View style={styles.noticeBanner}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.noticeTextCol}>
            <Text style={styles.noticeTitle}>Service Request Preparation (Phase 9)</Text>
            <Text style={styles.noticeBody}>
              This form prepares and validates your service request payload. Live booking submission API (POST /api/bookings) will be connected in Phase 10.
            </Text>
          </View>
        </View>

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
                <Text style={styles.summaryPrice}>₹{service.basePrice?.toLocaleString('en-IN') || 0}</Text>
                <Badge
                  label={PRICING_LABELS[service.pricingType] || service.pricingType}
                  variant="slate"
                  size="sm"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Selected Provider Card */}
        {provider && (
          <Card style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Selected Provider</Text>
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
            label="Street Address"
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
                label="City"
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
                onChangeText={(t) => {
                  setState(t);
                  if (formErrors.state) setFormErrors({ ...formErrors, state: null });
                }}
                error={formErrors.state}
              />
            </View>
          </View>

          <Input
            label="Postal Code (PIN)"
            placeholder="6-digit postal PIN"
            value={postalCode}
            onChangeText={(t) => {
              setPostalCode(t);
              if (formErrors.postalCode) setFormErrors({ ...formErrors, postalCode: null });
            }}
            keyboardType="number-pad"
            maxLength={6}
            error={formErrors.postalCode}
          />
        </Card>

        {/* Schedule & Timing Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Preferred Schedule</Text>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <Input
                label="Preferred Date"
                placeholder="YYYY-MM-DD"
                value={preferredDate}
                onChangeText={(t) => {
                  setPreferredDate(t);
                  if (formErrors.preferredDate) setFormErrors({ ...formErrors, preferredDate: null });
                }}
                leftIcon="calendar-outline"
                error={formErrors.preferredDate}
              />
            </View>
            <View style={styles.halfCol}>
              <Input
                label="Preferred Slot"
                placeholder="e.g. 10:00 AM"
                value={preferredTime}
                onChangeText={(t) => {
                  setPreferredTime(t);
                  if (formErrors.preferredTime) setFormErrors({ ...formErrors, preferredTime: null });
                }}
                leftIcon="time-outline"
                error={formErrors.preferredTime}
              />
            </View>
          </View>
        </Card>

        {/* Details & Description Card */}
        <Card style={styles.formCard}>
          <Text style={styles.sectionTitle}>Service Details & Contact</Text>

          <Input
            label="Problem Description"
            placeholder="Describe what needs repair, installation, or servicing..."
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
            onChangeText={(t) => {
              setContactPhone(t);
              if (formErrors.contactPhone) setFormErrors({ ...formErrors, contactPhone: null });
            }}
            keyboardType="phone-pad"
            maxLength={10}
            leftIcon="call-outline"
            error={formErrors.contactPhone}
          />
        </Card>

        {/* Prepared Payload Summary if Validated */}
        {preparedPayload && (
          <Card style={styles.stagedCard}>
            <View style={styles.stagedHeader}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.stagedTitle}>Payload Prepared & Validated</Text>
            </View>
            <Text style={styles.stagedSubtitle}>
              The service request has been validated according to the Phase 9 architecture. Ready for submission when Phase 10 API is connected.
            </Text>

            <View style={styles.payloadDetails}>
              <Text style={styles.payloadItem}>
                <Text style={styles.payloadKey}>Address: </Text>
                {preparedPayload.serviceAddress.street}, {preparedPayload.serviceAddress.city} - {preparedPayload.serviceAddress.postalCode}
              </Text>
              <Text style={styles.payloadItem}>
                <Text style={styles.payloadKey}>Schedule: </Text>
                {preparedPayload.schedule.date} at {preparedPayload.schedule.timeSlot}
              </Text>
              <Text style={styles.payloadItem}>
                <Text style={styles.payloadKey}>Contact: </Text>
                {preparedPayload.customerContact.phone}
              </Text>
            </View>
          </Card>
        )}

        {/* Action Button */}
        <Button
          title={preparedPayload ? "Re-validate Prepared Request" : "Validate & Prepare Request"}
          onPress={handlePrepareRequest}
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: spacing.lg,
    gap: spacing.sm
  },
  noticeTextCol: {
    flex: 1
  },
  noticeTitle: {
    ...typography.titleSmall,
    color: colors.primaryDark,
    fontSize: 14,
    marginBottom: 2
  },
  noticeBody: {
    ...typography.bodySmall,
    color: colors.slate700,
    lineHeight: 18
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
  stagedCard: {
    backgroundColor: colors.successSubtle,
    borderColor: '#A7F3D0',
    marginBottom: spacing.lg
  },
  stagedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  stagedTitle: {
    ...typography.titleSmall,
    color: '#065F46'
  },
  stagedSubtitle: {
    ...typography.bodySmall,
    color: '#047857',
    marginBottom: spacing.md
  },
  payloadDetails: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: 4
  },
  payloadItem: {
    ...typography.bodySmall,
    color: colors.slate800
  },
  payloadKey: {
    fontWeight: '700',
    color: colors.slate900
  },
  submitBtn: {
    marginTop: spacing.sm
  }
});
