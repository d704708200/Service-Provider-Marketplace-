import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { Input, Button, Card } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const validateEmail = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) return 'Email address is required';
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid email address';
    return null;
  };

  const handleSendResetEmail = async () => {
    setErrorMessage('');
    const validationErr = validateEmail(email);
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    if (cooldown > 0) return;

    setLoading(true);
    try {
      const response = await authApi.forgotPassword(email.trim().toLowerCase());
      setSuccessInfo({
        email: email.trim().toLowerCase(),
        message: response.message || 'If an account exists with this email, a reset link has been sent.'
      });
      startCooldown(60);
    } catch (err) {
      setErrorMessage(err.userMessage || err.message || 'Failed to send password reset email. Please try again.');
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
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Provider Password Reset</Text>
          <Text style={styles.subtitle}>
            Enter your provider account email to receive secure password reset instructions.
          </Text>
        </View>

        {/* Form Card */}
        <Card style={styles.formCard}>
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger || '#EF4444'} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {successInfo ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <Ionicons name="mail-unread-outline" size={32} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Check Your Inbox</Text>
              <Text style={styles.successDescription}>
                {successInfo.message}
              </Text>
              <Text style={styles.successEmail}>{successInfo.email}</Text>

              <Button
                title="Enter Reset Token"
                onPress={() => navigation?.navigate('ResetPassword')}
                style={styles.actionBtn}
              />

              <Button
                title={cooldown > 0 ? `Resend Link in ${cooldown}s` : 'Resend Email'}
                onPress={handleSendResetEmail}
                variant="outline"
                disabled={loading || cooldown > 0}
                style={styles.resendBtn}
              />
            </View>
          ) : (
            <View>
              <Input
                label="Registered Provider Email"
                placeholder="e.g. provider@example.com"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />

              <Button
                title={cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Reset Link'}
                onPress={handleSendResetEmail}
                loading={loading}
                disabled={loading || cooldown > 0}
                style={styles.submitBtn}
              />

              <TouchableOpacity
                style={styles.haveTokenBtn}
                onPress={() => navigation?.navigate('ResetPassword')}
                activeOpacity={0.7}
              >
                <Text style={styles.haveTokenText}>Already have a reset token?</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.backRow}>
            <TouchableOpacity
              onPress={() => navigation?.navigate('Login')}
              activeOpacity={0.7}
              style={styles.backLinkWrapper}
            >
              <Ionicons name="arrow-back" size={16} color="#A78BFA" />
              <Text style={styles.backLink}>Back to Provider Login</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: spacing.md
  },
  title: {
    ...typography.titleLarge,
    color: '#FFFFFF',
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20
  },
  formCard: {
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 18,
    padding: spacing.xl
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
  submitBtn: {
    marginTop: spacing.md,
    backgroundColor: '#7C3AED'
  },
  actionBtn: {
    marginTop: spacing.lg,
    backgroundColor: '#7C3AED'
  },
  resendBtn: {
    marginTop: spacing.md,
    borderColor: '#4C1D95'
  },
  haveTokenBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: 8
  },
  haveTokenText: {
    ...typography.bodySmall,
    color: '#A78BFA',
    fontWeight: '600'
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md
  },
  successIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  successTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    marginBottom: spacing.xs
  },
  successDescription: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 20
  },
  successEmail: {
    ...typography.bodyMedium,
    color: '#A78BFA',
    fontWeight: '700',
    marginBottom: spacing.md
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl
  },
  backLinkWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  backLink: {
    ...typography.bodyMedium,
    color: '#A78BFA',
    fontWeight: '600'
  }
});

