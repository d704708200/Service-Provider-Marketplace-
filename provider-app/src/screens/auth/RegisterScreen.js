import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Card } from '../../components/common';
import API_CONFIG from '../../config/env';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { register, error: authError, clearError } = useAuth();

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const validate = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters';
    }

    if (!businessName.trim()) {
      errors.businessName = 'Business name is required';
    } else if (businessName.trim().length < 2) {
      errors.businessName = 'Business name must be at least 2 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim()) {
      errors.phone = 'Mobile number is required';
    } else if (phoneDigits.length !== 10) {
      errors.phone = 'Mobile number must be a valid 10-digit number';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      errors.password = 'Password must contain at least one letter and one number';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!agreeTerms) {
      errors.terms = 'You must agree to the Terms & Conditions and Privacy Policy';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const result = await register({
        name: name.trim(),
        businessName: businessName.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        password
      });

      if (!result.success) {
        // Handled in context / displayed in authError banner
      }
    } catch {
      // Handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header & Back Option */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                clearError();
                navigation?.goBack();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={require('../../../assets/mendroo-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Create Provider Account</Text>
          <Text style={styles.subtitle}>
            Register your business to start receiving service bookings, client inquiries, and dispatch requests
          </Text>
        </View>

        {/* Form Card */}
        <Card style={styles.formCard}>
          {authError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          {/* 5-Step Registration & KYC Flow Notice */}
          <View style={styles.noticeBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#A78BFA" />
            <Text style={styles.noticeText}>
              <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>Step 1 of 5: </Text>
              Submit your basic registration details, then complete <Text style={styles.noticeHighlight}>Aadhaar & PAN Card KYC</Text> verification to activate customer dispatch.
            </Text>
          </View>

          <Input
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (formErrors.name) setFormErrors({ ...formErrors, name: null });
            }}
            autoCapitalize="words"
            leftIcon="person-outline"
            error={formErrors.name}
          />

          <Input
            label="Business / Enterprise Name"
            placeholder="e.g. Apex Plumbing Solutions"
            value={businessName}
            onChangeText={(text) => {
              setBusinessName(text);
              if (formErrors.businessName) setFormErrors({ ...formErrors, businessName: null });
            }}
            autoCapitalize="words"
            leftIcon="business-outline"
            error={formErrors.businessName}
          />

          <Input
            label="Email Address"
            placeholder="e.g. provider@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (formErrors.email) setFormErrors({ ...formErrors, email: null });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={formErrors.email}
          />

          <Input
            label="Mobile Number"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (formErrors.phone) setFormErrors({ ...formErrors, phone: null });
            }}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            maxLength={10}
            error={formErrors.phone}
          />

          <Input
            label="Password"
            placeholder="At least 6 chars (letters & numbers)"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (formErrors.password) setFormErrors({ ...formErrors, password: null });
            }}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={formErrors.password}
          />

          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (formErrors.confirmPassword) setFormErrors({ ...formErrors, confirmPassword: null });
            }}
            secureTextEntry
            leftIcon="shield-checkmark-outline"
            error={formErrors.confirmPassword}
          />

          {/* Terms & Conditions Checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              setAgreeTerms(!agreeTerms);
              if (formErrors.terms) setFormErrors({ ...formErrors, terms: null });
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
              {agreeTerms ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsHighlight}>Terms and Conditions</Text> & <Text style={styles.termsHighlight}>Provider Service Agreement</Text>
            </Text>
          </TouchableOpacity>
          {formErrors.terms ? (
            <Text style={styles.fieldErrorText}>{formErrors.terms}</Text>
          ) : null}

          <Button
            title="Create Provider Account"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
          />

          {/* Navigation to Sign In */}
          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                navigation?.navigate('Login');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Connectivity Indicator */}
          <View style={styles.connectivityRow}>
            <View style={styles.activeDot} />
            <Text style={styles.connectivityText} numberOfLines={1}>
              API Endpoint: {API_CONFIG.BASE_URL}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center'
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.xs
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2F2B48'
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12
  },
  title: {
    ...typography.titleLarge,
    color: '#FFFFFF',
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    lineHeight: 20
  },
  formCard: {
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 18,
    padding: spacing.xl
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm
  },
  noticeText: {
    ...typography.bodySmall,
    color: '#DDD6FE',
    flex: 1,
    lineHeight: 18
  },
  noticeHighlight: {
    color: '#FBBF24',
    fontWeight: '700'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4C0519',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#991B1B',
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: '#F87171',
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500'
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#4B5563',
    backgroundColor: '#1E1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  checkboxActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  termsText: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    flex: 1,
    lineHeight: 18
  },
  termsHighlight: {
    color: '#A78BFA',
    fontWeight: '600'
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 2,
    marginBottom: spacing.sm,
    fontWeight: '500'
  },
  submitBtn: {
    marginTop: spacing.md,
    backgroundColor: '#7C3AED'
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.xs
  },
  signInPrompt: {
    ...typography.bodyMedium,
    color: '#9CA3AF'
  },
  signInLink: {
    ...typography.bodyMedium,
    color: '#A78BFA',
    fontWeight: '700'
  },
  connectivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#252136',
    gap: 6
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981'
  },
  connectivityText: {
    ...typography.caption,
    color: '#6B7280',
    fontSize: 11
  }
});
