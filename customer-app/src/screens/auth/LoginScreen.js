import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Input, Button, Card } from '../../components/common';
import { spacing, typography, borderRadius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { login, error: authError, clearError } = useAuth();

  const scrollViewRef = useRef(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showListener, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideListener, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePasswordFocus = () => {
    // When password is focused, scroll slightly to ensure Login button is comfortably accessible above keyboard
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

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
    Keyboard.dismiss();
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + (isKeyboardVisible ? spacing.sm : spacing.xl),
              paddingBottom: insets.bottom + (isKeyboardVisible ? 140 : spacing.xl)
            },
            isKeyboardVisible && styles.scrollContentKeyboard
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Header */}
          <View style={[styles.header, isKeyboardVisible && styles.headerKeyboard]}>
            <Image
              source={require('../../../assets/mendroo-logo.png')}
              style={[styles.logoImage, isKeyboardVisible && styles.logoImageKeyboard]}
              resizeMode="contain"
            />
            <Text style={styles.title}>Welcome Back</Text>
            {!isKeyboardVisible && (
              <Text style={styles.subtitle}>Sign in to your customer account to book local services</Text>
            )}
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
              onFocus={handlePasswordFocus}
              secureTextEntry
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.slate400} />}
              error={formErrors.password}
            />

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => {
                Keyboard.dismiss();
                clearError();
                navigation.navigate('ForgotPassword');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
            </TouchableOpacity>

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
                  Keyboard.dismiss();
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center'
  },
  scrollContentKeyboard: {
    justifyContent: 'flex-start'
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  headerKeyboard: {
    marginBottom: spacing.md
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: spacing.md
  },
  logoImageKeyboard: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginBottom: spacing.xs
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280
  },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.xl
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#4C0519' : '#FEE2E2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: isDark ? '#991B1B' : '#FCA5A5',
    padding: spacing.md,
    marginBottom: spacing.lg
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: isDark ? '#F87171' : '#B91C1C',
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500'
  },
  submitBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: 4
  },
  forgotPasswordLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600'
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl
  },
  registerPrompt: {
    ...typography.bodyMedium,
    color: colors.textSecondary
  },
  registerLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700'
  }
});
