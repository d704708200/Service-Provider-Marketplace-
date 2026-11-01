import { Linking, Alert, Platform } from 'react-native';

/**
 * Normalizes phone numbers for telephony dialers.
 * Supports:
 * - "+919876543210" -> "+919876543210"
 * - "9876543210" (10-digit Indian standard) -> "+919876543210"
 * - "919876543210" -> "+919876543210"
 * - International numbers with leading '+'
 */
export const normalizePhoneNumber = (rawPhone) => {
  if (!rawPhone || (typeof rawPhone !== 'string' && typeof rawPhone !== 'number')) {
    return null;
  }

  const str = String(rawPhone).trim();
  if (!str) return null;

  const hasLeadingPlus = str.startsWith('+');
  const digitsOnly = str.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 7) {
    return null;
  }

  if (hasLeadingPlus) {
    return `+${digitsOnly}`;
  }

  // Standard 10-digit Indian mobile number
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return `+91${digitsOnly}`;
  }

  // 12-digit Indian number without leading +
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  return digitsOnly;
};

/**
 * Initiates phone call safely using Linking.openURL with comprehensive guards.
 */
export const callPhoneNumber = async (phoneNumber, recipientName = 'Service Provider') => {
  if (!phoneNumber) {
    Alert.alert(
      'Contact Unavailable',
      `${recipientName}'s phone number is not available or has expired after warranty.`
    );
    return false;
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) {
    Alert.alert(
      'Invalid Phone Number',
      `The phone number for ${recipientName} is invalid or formatted incorrectly.`
    );
    return false;
  }

  const url = `tel:${normalized}`;

  try {
    const canOpen = await Linking.canOpenURL(url).catch(() => false);

    if (!canOpen && Platform.OS !== 'android' && Platform.OS !== 'ios') {
      // In web browser preview where native dialer is absent
      Alert.alert(
        'Call Provider',
        `Provider: ${recipientName}\nPhone: ${normalized}\n(Voice dialing is not supported in this browser window)`
      );
      return true;
    }

    await Linking.openURL(url);
    return true;
  } catch (err) {
    Alert.alert(
      'Call Failed',
      `Could not initiate phone call to ${normalized}. Please check device phone permissions.`
    );
    return false;
  }
};

