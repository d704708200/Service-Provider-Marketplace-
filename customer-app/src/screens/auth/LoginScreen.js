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
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Card } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login, error: authError, clearError } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!identifier.trim()) {
      errors.identifier = 'Email or phone number is required';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    clearError();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await login({
        identifier: identifier.trim(),
        password
      });

      if (!result.success) {
        // Error is set in AuthContext
      }
    } catch (err) {
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your customer account to book local services</Text>
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
            label="Email Address"
            placeholder="e.g. customer@example.com"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (formErrors.identifier) setFormErrors({ ...formErrors, identifier: null });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Ionicons name="mail-outline" size={20} color={colors.slate400} />}
            error={formErrors.identifier}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (formErrors.password) setFormErrors({ ...formErrors, password: null });
            }}
            secureTextEntry
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.slate400} />}
            error={formErrors.password}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                navigation.navigate('Register');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLink}>Sign Up</Text>
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
    maxWidth: 280
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
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl
  },
  registerPrompt: {
    ...typography.bodyMedium,
    color: '#9CA3AF'
  },
  registerLink: {
    ...typography.bodyMedium,
    color: '#A78BFA',
    fontWeight: '700'
  }
});
