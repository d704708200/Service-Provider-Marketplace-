import React, { useState } from 'react';
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

export default function ResetPasswordScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initialToken = route?.params?.token || '';

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!token.trim()) {
      errors.token = 'Reset token is required';
    }
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm your new password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleResetPassword = async () => {
    setErrorMessage('');
    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword
      });
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(err.userMessage || err.message || 'Failed to reset password. The link or token may have expired.');
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
          <Text style={styles.title}>Provider New Password</Text>
          <Text style={styles.subtitle}>
            Enter your reset token and configure a new password for your provider dashboard.
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

          {isSuccess ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconWrapper}>
                <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Password Reset Successful!</Text>
              <Text style={styles.successDescription}>
                Your provider account password has been updated. You can now log in using your new credentials.
              </Text>

              <Button
                title="Proceed to Provider Login"
                onPress={() => navigation?.navigate('Login')}
                style={styles.actionBtn}
              />
            </View>
          ) : (
            <View>
              <Input
                label="Reset Token"
                placeholder="Paste or enter 64-character token"
                value={token}
                onChangeText={(text) => {
                  setToken(text);
                  if (fieldErrors.token) setFieldErrors({ ...fieldErrors, token: null });
                }}
                autoCapitalize="none"
                leftIcon="key-outline"
                error={fieldErrors.token}
              />

              <Input
                label="New Password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (fieldErrors.newPassword) setFieldErrors({ ...fieldErrors, newPassword: null });
                }}
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={fieldErrors.newPassword}
              />

              <Input
                label="Confirm New Password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: null });
                }}
                secureTextEntry
                leftIcon="lock-closed-outline"
                error={fieldErrors.confirmPassword}
              />

              <Button
                title="Reset Password"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading}
                style={styles.submitBtn}
              />
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
    marginBottom: spacing.md,
    lineHeight: 20
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

