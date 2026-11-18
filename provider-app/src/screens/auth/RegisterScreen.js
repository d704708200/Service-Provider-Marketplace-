import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableWithoutFeedback
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Input, Button, Card } from '../../components/common';
import { categoryApi } from '../../services/api';
import API_CONFIG from '../../config/env';
import { useTheme } from '../../context/ThemeContext';
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE, PLATFORM_NAME } from '../../constants/providerTerms';
import { spacing, typography, borderRadius } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
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

  // Dynamic Categories state
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);

  // Dropdown & Search state
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const res = await categoryApi.getPublicCategories();
      if (res?.success && Array.isArray(res.data)) {
        setCategoriesList(res.data);
      } else {
        setCategoriesError('Failed to load service categories.');
      }
    } catch (err) {
      setCategoriesError(err.userMessage || err.message || 'Unable to fetch categories.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((prev) => {
      let updated;
      if (prev.includes(categoryId)) {
        updated = prev.filter((id) => id !== categoryId);
      } else {
        updated = [...prev, categoryId];
      }
      if (formErrors.categories && updated.length > 0) {
        setFormErrors((curr) => ({ ...curr, categories: null }));
      }
      return updated;
    });
  };

  const removeCategory = (categoryId) => {
    setSelectedCategoryIds((prev) => prev.filter((id) => id !== categoryId));
  };

  const clearAllCategories = () => {
    setSelectedCategoryIds([]);
  };

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoriesList;
    const q = searchQuery.toLowerCase().trim();
    return categoriesList.filter((cat) =>
      cat?.name?.toLowerCase().includes(q) || cat?.description?.toLowerCase().includes(q)
    );
  }, [categoriesList, searchQuery]);

  // Lookup map for selected category details
  const selectedCategoriesData = useMemo(() => {
    return selectedCategoryIds
      .map((id) => categoriesList.find((c) => c._id === id))
      .filter(Boolean);
  }, [selectedCategoryIds, categoriesList]);

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

    if (selectedCategoryIds.length === 0) {
      errors.categories = 'Please select at least one service category';
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
      errors.terms = 'You must read and agree to the MENDROO Service Provider Terms & Conditions to register.';
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
        password,
        categories: selectedCategoryIds,
        acceptedTerms: true,
        termsVersion: CURRENT_TERMS_VERSION
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
      <ScrollView showsHorizontalScrollIndicator={false}
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
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
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
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.noticeText}>
              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Step 1 of 5: </Text>
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

          {/* Multi-Select Dropdown: Service Categories */}
          <View style={styles.dropdownFieldContainer}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Service Categories *</Text>
              {selectedCategoryIds.length > 0 && (
                <View style={styles.selectedCountBadge}>
                  <Text style={styles.selectedCountText}>
                    {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'category' : 'categories'} selected
                  </Text>
                </View>
              )}
            </View>

            {/* Dropdown Trigger Box */}
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                Boolean(formErrors.categories) && styles.dropdownTriggerError,
                dropdownVisible && styles.dropdownTriggerActive
              ]}
              onPress={() => {
                setSearchQuery('');
                setDropdownVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownTriggerLeft}>
                <Ionicons
                  name="pricetag-outline"
                  size={18}
                  color={selectedCategoryIds.length > 0 ? '#A78BFA' : '#6B7280'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.dropdownPlaceholder,
                    selectedCategoryIds.length > 0 && styles.dropdownValueText
                  ]}
                  numberOfLines={1}
                >
                  {selectedCategoryIds.length === 0
                    ? 'Select your service categories'
                    : `${selectedCategoryIds.length} ${selectedCategoryIds.length === 1 ? 'category selected' : 'categories selected'}`}
                </Text>
              </View>
              <View style={styles.dropdownTriggerRight}>
                {categoriesLoading ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <Ionicons
                    name={dropdownVisible ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                  />
                )}
              </View>
            </TouchableOpacity>

            {/* Error Message for Categories */}
            {formErrors.categories ? (
              <Text style={styles.fieldErrorText}>{formErrors.categories}</Text>
            ) : null}

            {/* Selected Categories Chips / Tags */}
            {selectedCategoriesData.length > 0 && (
              <View style={styles.chipsContainer}>
                {selectedCategoriesData.map((cat) => (
                  <View key={cat._id} style={styles.categoryChip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeCategory(cat._id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.chipRemoveBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle" size={16} color="#C4B5FD" />
                    </TouchableOpacity>
                  </View>
                ))}
                {selectedCategoriesData.length > 1 && (
                  <TouchableOpacity
                    onPress={clearAllCategories}
                    style={styles.clearAllInlineBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearAllInlineText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

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

          {/* Mandatory Legal Agreement Section */}
          <View style={styles.legalSection}>
            <View style={styles.legalHeaderRow}>
              <View style={styles.legalHeaderLeft}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#A78BFA" />
                <Text style={styles.legalSectionTitle}>Provider Terms & Conditions</Text>
              </View>
              <Text style={styles.legalEffectiveDate}>Effective: {TERMS_EFFECTIVE_DATE}</Text>
            </View>

            <View style={styles.legalLinkRow}>
              <TouchableOpacity
                onPress={() => navigation?.navigate('ProviderTerms')}
                style={styles.readFullTermsLink}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text-outline" size={14} color="#C4B5FD" />
                <Text style={styles.readFullTermsText}>Read Full Terms & Conditions</Text>
                <Ionicons name="chevron-forward" size={14} color="#C4B5FD" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.termsRow, formErrors.terms && styles.termsRowError]}
              onPress={() => {
                setAgreeTerms(!agreeTerms);
                if (formErrors.terms) setFormErrors({ ...formErrors, terms: null });
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                {agreeTerms ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.termsText}>
                I have read and agree to the {PLATFORM_NAME} Service Provider Terms & Conditions.
              </Text>
            </TouchableOpacity>
            {formErrors.terms ? (
              <Text style={styles.fieldErrorText}>{formErrors.terms}</Text>
            ) : null}
          </View>

          <Button
            title="Create Provider Account"
            onPress={handleRegister}
            loading={loading}
            disabled={loading || !agreeTerms}
            style={[styles.submitBtn, (!agreeTerms || loading) && styles.submitBtnDisabled]}
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

      {/* Multi-Select Categories Modal / Dropdown */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Select Service Categories</Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedCategoryIds.length} of {categoriesList.length} categories chosen
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setDropdownVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Search Bar Inside Dropdown */}
                <View style={styles.searchContainer}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search categories..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Categories List View */}
                <View style={styles.listWrapper}>
                  {categoriesLoading ? (
                    <View style={styles.modalLoadingBox}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.modalLoadingText}>Loading service categories...</Text>
                    </View>
                  ) : categoriesError ? (
                    <View style={styles.modalErrorBox}>
                      <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
                      <Text style={styles.modalErrorText}>{categoriesError}</Text>
                      <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchCategories}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh" size={14} color="#FFFFFF" />
                        <Text style={styles.retryBtnText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : categoriesList.length === 0 ? (
                    <View style={styles.modalEmptyBox}>
                      <Ionicons name="folder-open-outline" size={28} color={colors.textMuted} />
                      <Text style={styles.modalEmptyText}>No service categories currently available.</Text>
                      <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchCategories}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.retryBtnText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                  ) : filteredCategories.length === 0 ? (
                    <View style={styles.modalEmptyBox}>
                      <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                      <Text style={styles.modalEmptyText}>No categories match "{searchQuery}"</Text>
                    </View>
                  ) : (
                    <ScrollView showsHorizontalScrollIndicator={false}
                      style={styles.categoryScrollView}
                      contentContainerStyle={styles.categoryScrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredCategories.map((cat) => {
                        const isSelected = selectedCategoryIds.includes(cat._id);
                        return (
                          <TouchableOpacity
                            key={cat._id}
                            style={[
                              styles.categoryItemRow,
                              isSelected && styles.categoryItemRowSelected
                            ]}
                            onPress={() => toggleCategorySelection(cat._id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.categoryItemCheckbox, isSelected && styles.categoryItemCheckboxSelected]}>
                              {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                            </View>
                            <View style={styles.categoryItemInfo}>
                              <Text
                                style={[
                                  styles.categoryItemName,
                                  isSelected && styles.categoryItemNameSelected
                                ]}
                                numberOfLines={1}
                              >
                                {cat.name}
                              </Text>
                              {cat.description ? (
                                <Text style={styles.categoryItemDesc} numberOfLines={1}>
                                  {cat.description}
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                {/* Modal Actions Footer: Clear All & Done */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.clearAllBtn}
                    onPress={clearAllCategories}
                    disabled={selectedCategoryIds.length === 0}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.clearAllBtnText,
                        selectedCategoryIds.length === 0 && styles.clearAllBtnTextDisabled
                      ]}
                    >
                      Clear All
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setDropdownVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneBtnText}>
                      Done {selectedCategoryIds.length > 0 ? `(${selectedCategoryIds.length})` : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center'
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    marginBottom: spacing.sm
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10
  },
  headerLogo: {
    width: 140,
    height: 38
  },
  title: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 20
  },
  formCard: {
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.danger,
    flex: 1,
    lineHeight: 18
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? '#1E1B2E' : '#F5F3FF',
    borderWidth: 1,
    borderColor: isDark ? '#3B2D54' : '#DDD6FE',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm
  },
  noticeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18
  },
  noticeHighlight: {
    color: colors.primary,
    fontWeight: '700'
  },
  legalSection: {
    backgroundColor: isDark ? '#1E1B2E' : '#F8FAFC',
    borderWidth: 1,
    borderColor: isDark ? '#3B2D54' : '#E2E8F0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs
  },
  legalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  legalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  legalEffectiveDate: {
    fontSize: 11,
    color: colors.textMuted
  },
  legalLinkRow: {
    marginBottom: spacing.sm
  },
  readFullTermsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6
  },
  readFullTermsText: {
    fontSize: 12,
    color: isDark ? '#C4B5FD' : '#6D28D9',
    fontWeight: '600'
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    gap: spacing.sm
  },
  termsRowError: {
    borderColor: colors.danger
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  termsText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19
  },
  fieldErrorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
    fontWeight: '500'
  },
  submitBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary
  },
  submitBtnDisabled: {
    backgroundColor: isDark ? '#374151' : '#CBD5E1',
    opacity: 0.6
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg
  },
  signInPrompt: {
    ...typography.bodyMedium,
    color: colors.textSecondary
  },
  signInLink: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700'
  },
  connectivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 6
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success || '#10B981'
  },
  connectivityText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11
  },

  /* Dropdown Field Styles */
  dropdownFieldContainer: {
    marginBottom: spacing.md
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  selectedCountBadge: {
    backgroundColor: isDark ? '#2E1065' : '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary
  },
  selectedCountText: {
    color: isDark ? '#DDD6FE' : '#6D28D9',
    fontSize: 11,
    fontWeight: '600'
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48
  },
  dropdownTriggerActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? '#12101A' : '#FAF5FF'
  },
  dropdownTriggerError: {
    borderColor: colors.danger
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  dropdownTriggerRight: {
    marginLeft: spacing.sm
  },
  dropdownPlaceholder: {
    ...typography.bodyMedium,
    color: colors.textMuted
  },
  dropdownValueText: {
    color: colors.textPrimary,
    fontWeight: '600'
  },

  /* Selected Chips / Tags */
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center'
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#2E1065' : '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6
  },
  chipText: {
    fontSize: 12,
    color: isDark ? '#DDD6FE' : '#6D28D9',
    fontWeight: '600'
  },
  chipRemoveBtn: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearAllInlineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  clearAllInlineText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    textDecorationLine: 'underline'
  },

  /* Dropdown Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  modalContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 42
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    paddingVertical: 0
  },
  listWrapper: {
    flexShrink: 1,
    minHeight: 180,
    maxHeight: 340
  },
  categoryScrollView: {
    flexGrow: 1
  },
  categoryScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: 4
  },
  categoryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: isDark ? '#12101A' : '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border
  },
  categoryItemRowSelected: {
    backgroundColor: isDark ? '#1E1833' : '#F5F3FF',
    borderColor: colors.primary
  },
  categoryItemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  categoryItemCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryItemInfo: {
    flex: 1
  },
  categoryItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  categoryItemNameSelected: {
    color: colors.primary,
    fontWeight: '700'
  },
  categoryItemDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  modalLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  modalLoadingText: {
    fontSize: 12,
    color: colors.textMuted
  },
  modalErrorBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs
  },
  modalErrorText: {
    fontSize: 12,
    color: colors.danger,
    textAlign: 'center'
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    marginTop: spacing.xs
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  modalEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs
  },
  modalEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cardSecondary
  },
  clearAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  clearAllBtnText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600'
  },
  clearAllBtnTextDisabled: {
    color: colors.textMuted
  },
  doneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
