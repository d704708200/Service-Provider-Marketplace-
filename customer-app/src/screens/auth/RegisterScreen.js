import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Card } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { register, error: authError, clearError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (phoneDigits.length !== 10) {
      errors.phone = 'Phone must be a valid 10-digit number';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
      errors.password = 'Password must contain at least one letter and one number';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
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
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        password
      });

      if (!result.success) {
        // Handled in context
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
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              clearError();
              navigation.goBack();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.slate900} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join as a customer to discover and book verified services</Text>
        </View>

        {/* Card */}
        <Card style={styles.formCard}>
          {authError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorBannerText}>{authError}</Text>
            </View>
          ) : null}

          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (formErrors.name) setFormErrors({ ...formErrors, name: null });
            }}
            autoCapitalize="words"
            leftIcon={<Ionicons name="person-outline" size={20} color={colors.slate400} />}
            error={formErrors.name}
          />

          <Input
            label="Email Address"
            placeholder="john@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (formErrors.email) setFormErrors({ ...formErrors, email: null });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Ionicons name="mail-outline" size={20} color={colors.slate400} />}
            error={formErrors.email}
          />

          <Input
            label="Phone Number"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (formErrors.phone) setFormErrors({ ...formErrors, phone: null });
            }}
            keyboardType="phone-pad"
            leftIcon={<Ionicons name="call-outline" size={20} color={colors.slate400} />}
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
            leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.slate400} />}
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
            leftIcon={<Ionicons name="shield-checkmark-outline" size={20} color={colors.slate400} />}
            error={formErrors.confirmPassword}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
          />

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => {
                clearError();
                navigation.navigate('Login');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLink}>Sign In</Text>
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
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.xs
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    padding: spacing.xs
  },
  title: {
    ...typography.titleLarge,
    color: colors.slate900,
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.slate500
  },
  formCard: {
    padding: spacing.xl
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500'
  },
  submitBtn: {
    marginTop: spacing.sm
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl
  },
  loginPrompt: {
    ...typography.bodyMedium,
    color: colors.slate600
  },
  loginLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700'
  }
});
