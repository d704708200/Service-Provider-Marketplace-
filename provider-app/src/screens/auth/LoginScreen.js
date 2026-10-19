import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Card } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, error: authError, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email address is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
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
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/mendroo-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Provider Portal</Text>
          <Text style={styles.subtitle}>Sign in to manage service bookings, incoming requests, and dispatching</Text>
        </View>

        {/* Form Card */}
        <Card style={styles.formCard}>
          {authError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          <Input
            label="Provider Email Address"
            placeholder="e.g. provider@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: null });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: null });
            }}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={errors.password}
          />

          <Button
            title="Sign In as Provider"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
          />
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
    width: 88,
    height: 88,
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
    maxWidth: 300
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
    marginTop: spacing.sm,
    backgroundColor: '#7C3AED'
  }
});
