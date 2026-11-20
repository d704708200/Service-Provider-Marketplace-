import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Platform,
  Image,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { providerApi } from '../../services/api';
import { Header, Card, Badge, Button, Input, AppearanceSettings, SupportContactCard } from '../../components/common';
import { getApiBaseUrl, API_CONFIG } from '../../config/env';
import { CURRENT_TERMS_VERSION, TERMS_EFFECTIVE_DATE, PLATFORM_NAME } from '../../constants/providerTerms';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user, profile: authProfile, logout, checkAuthSession, refreshProviderProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [loggingOut, setLoggingOut] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (typeof refreshProviderProfile === 'function') {
        refreshProviderProfile().then(setProfile).catch(() => {});
      }
    }, [refreshProviderProfile])
  );

  useEffect(() => {
    setProfile(authProfile);
  }, [authProfile]);

  // Helper to format avatar URL with full backend base URL for relative paths
  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    let url = avatarPath;
    if (url.startsWith('/')) {
      const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '');
      url = `${baseUrl}${url}`;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheBuster}`;
  };

  const handlePickAndUploadPhoto = async () => {
    if (uploadingPhoto) return;

    try {
      // 1. Request photo library permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Photo library access is required to update your business profile photo. Please enable it in system settings.'
        );
        return;
      }

      // 2. Open Image Picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert('Upload Error', 'Selected image could not be loaded.');
        return;
      }

      setUploadingPhoto(true);

      // 3. Prepare FormData for browser vs native
      const formData = new FormData();
      const uri = asset.uri;
      const cleanExt = (asset.mimeType?.includes('png') || uri.endsWith('.png')) ? 'png' : 'jpg';
      const safeFilename = `provider_avatar_${Date.now()}.${cleanExt}`;
      const safeMimeType = asset.mimeType || (cleanExt === 'png' ? 'image/png' : 'image/jpeg');

      if (Platform.OS === 'web') {
        // In browser (React Native Web)
        if (asset.file instanceof Blob) {
          formData.append('avatar', asset.file, safeFilename);
        } else {
          // Fetch data URI or blob URL
          const fetchRes = await fetch(uri);
          const blob = await fetchRes.blob();
          const file = new File([blob], safeFilename, { type: safeMimeType });
          formData.append('avatar', file, safeFilename);
        }
      } else {
        // Native React Native (iOS / Android)
        formData.append('avatar', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: safeFilename,
          type: safeMimeType
        });
      }

      // 4. Call upload API
      const res = await providerApi.uploadAvatar(formData);

      if (res?.success && res.data) {
        setProfile(res.data);
        setCacheBuster(Date.now());
        await checkAuthSession();
        Alert.alert('Success', 'Profile photo updated successfully!');
      } else {
        Alert.alert('Upload Failed', res?.message || 'Could not update profile photo.');
      }
    } catch (err) {
      console.error('Provider photo upload error:', err);
      Alert.alert(
        'Upload Failed',
        err.userMessage || err.message || 'An error occurred while uploading your profile photo.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Edit Profile Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [experienceYears, setExperienceYears] = useState('1');
  const [isAvailable, setIsAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await providerApi.getProfile();
      if (res?.success && res.data) {
        setProfile(res.data);
      }
    } catch (err) {
      console.warn('Error fetching provider profile:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkAuthSession(), fetchProfile()]);
    setRefreshing(false);
  };

  const handleOpenEdit = () => {
    setBusinessName(profile?.businessName || user?.name || '');
    setBio(profile?.bio || '');
    setPhone(profile?.user?.phone || user?.phone || '');
    setExperienceYears(profile?.experienceYears?.toString() || '1');
    setIsAvailable(profile?.isAvailable !== undefined ? Boolean(profile.isAvailable) : true);
    setErrorMsg(null);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!businessName.trim()) {
      setErrorMsg('Business / Trade name is required.');
      return;
    }
    const expNum = Number(experienceYears);
    if (isNaN(expNum) || expNum < 0) {
      setErrorMsg('Experience must be a non-negative number.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      businessName: businessName.trim(),
      bio: bio.trim(),
      phone: phone.trim(),
      experienceYears: expNum,
      isAvailable
    };

    try {
      const res = await providerApi.updateProfile(payload);
      if (res?.success) {
        setProfile(res.data);
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully.');
        await checkAuthSession();
      }
    } catch (err) {
      setErrorMsg(err.userMessage || err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
      Alert.alert('Sign Out Failed', err.message || 'Could not complete sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to sign out of Provider Portal?')
        : true;
      if (confirmed) {
        performLogout();
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out of Provider Portal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: performLogout }
    ]);
  };

  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await providerApi.deleteAccount(deletePassword || undefined);
      setDeletingAccount(false);
      setIsDeleteModalOpen(false);
      setDeletePassword('');
      Alert.alert(
        'Account Deleted',
        'Your MENDROO provider partner account and personal data have been permanently deleted in accordance with data retention standards.',
        [{ text: 'OK', onPress: () => logout() }]
      );
    } catch (err) {
      setDeletingAccount(false);
      Alert.alert(
        'Deletion Failed',
        err?.response?.data?.message || err?.message || 'Could not delete provider account. Please resolve active jobs or try again.'
      );
    }
  };

  const verificationStatus = profile?.verificationStatus || 'pending';
  const storedKycStatus = String(profile?.kycStatus || '').toUpperCase();
  const isKycApproved = ['APPROVED', 'VERIFIED'].includes(storedKycStatus);
  const isKycRejected = storedKycStatus === 'REJECTED';
  const isKycPending = !isKycApproved && !isKycRejected && ['PENDING', 'UNDER_REVIEW'].includes(storedKycStatus);

  return (
    <View style={styles.container}>
      <Header
        title="Provider Account"
        subtitle="Business Profile & Settings"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Verification Status Banner */}
        {verificationStatus !== 'verified' && (
          <Card
            style={[
              styles.card,
              verificationStatus === 'pending'
                ? styles.pendingCard
                : styles.rejectedCard
            ]}
          >
            <View style={styles.statusBannerRow}>
              <Ionicons
                name={verificationStatus === 'pending' ? 'time-outline' : 'alert-circle'}
                size={22}
                color={verificationStatus === 'pending' ? '#F59E0B' : '#EF4444'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.statusBannerTitle,
                    { color: verificationStatus === 'pending' ? '#FBBF24' : '#F87171' }
                  ]}
                >
                  {verificationStatus === 'pending'
                    ? 'Account Verification Under Review'
                    : 'Account Verification Action Required'}
                </Text>
                <Text
                  style={[
                    styles.statusBannerDesc,
                    { color: verificationStatus === 'pending' ? '#FCD34D' : '#FCA5A5' }
                  ]}
                >
                  {verificationStatus === 'pending'
                    ? (isKycPending
                      ? 'Platform administrators are reviewing your KYC documents (Aadhaar & PAN).'
                      : isKycApproved
                      ? 'KYC verification is complete. Your provider account is awaiting review.'
                      : isKycRejected
                      ? (profile?.kycRejectionReason || 'Please upload corrected Aadhaar and PAN documents.')
                      : 'Upload required Aadhaar and PAN documents in KYC Verification to proceed with account approval.')
                    : profile?.kycRejectionReason || profile?.rejectionReason || 'Please review your uploaded KYC documents or contact support.'}
                </Text>
                <TouchableOpacity
                  style={styles.kycActionBtn}
                  onPress={() => navigation.navigate('KYC')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shield-checkmark-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.kycActionBtnText}>
                    {isKycPending || isKycApproved
                      ? 'View KYC Status'
                      : isKycRejected
                      ? 'Correct KYC Documents'
                      : 'Complete KYC Verification'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}

        {/* Profile Card */}
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickAndUploadPhoto}
              activeOpacity={0.8}
              disabled={uploadingPhoto}
            >
              {(() => {
                const avatarUrl = getFullAvatarUrl(profile?.user?.avatar || user?.avatar);
                if (avatarUrl) {
                  return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
                }
                return (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="business" size={28} color="#A78BFA" />
                  </View>
                );
              })()}

              {uploadingPhoto ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.infoCol}>
              <Text style={styles.name}>{profile?.businessName || user?.name || 'Service Partner'}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <Badge
                label={verificationStatus.toUpperCase()}
                variant={
                  verificationStatus === 'verified'
                    ? 'success'
                    : verificationStatus === 'pending'
                      ? 'warning'
                      : 'danger'
                }
                size="sm"
                style={{ marginTop: 6 }}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={handleOpenEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color="#A78BFA" />
            <Text style={styles.editProfileBtnText}>Edit Business Profile</Text>
          </TouchableOpacity>
        </Card>

        {/* Quick Management Shortcuts */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Operations Management</Text>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E1065' : '#EDE9FE' }]}>
                <Ionicons name="wallet-outline" size={18} color={isDark ? '#C4B5FD' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1}>Wallet & Payouts</Text>
                <Text style={styles.navSub} numberOfLines={1}>Balance, earnings breakdown & withdrawals</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Availability')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={18} color={isDark ? '#A78BFA' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1}>Weekly Availability Schedule</Text>
                <Text style={styles.navSub} numberOfLines={1}>Set working hours for each day</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ServiceAreas')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="map-outline" size={18} color={isDark ? '#A78BFA' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1}>Service Areas & Zip Codes</Text>
                <Text style={styles.navSub} numberOfLines={1}>Manage coverage territories</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('KYC')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E1065' : '#EDE9FE' }]}>
                <Ionicons name="shield-checkmark" size={18} color={isDark ? '#C4B5FD' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1}>KYC Verification</Text>
                <Text style={styles.navSub} numberOfLines={1}>Aadhaar & PAN document compliance</Text>
              </View>
            </View>
            <View style={styles.navRight}>
              <View style={[
                styles.kycNavBadge,
                isKycApproved ? styles.kycNavBadgeVerified :
                  isKycRejected ? styles.kycNavBadgeRejected :
                    isKycPending ? styles.kycNavBadgePending :
                      styles.kycNavBadgePending
              ]}>
                <Text style={styles.kycNavBadgeText}>
                  {isKycApproved
                    ? 'VERIFIED'
                    : isKycRejected
                    ? 'REJECTED'
                    : isKycPending
                    ? 'UNDER REVIEW'
                    : 'ACTION NEEDED'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('OfferedServices')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="pricetag-outline" size={18} color={isDark ? '#A78BFA' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1}>Services & Pricing Catalog</Text>
                <Text style={styles.navSub} numberOfLines={1}>Configure service offerings & rates</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </Card>

        {/* Performance Stats */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Performance Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{profile?.completedBookingsCount || 0}</Text>
              <Text style={styles.statLabel}>Completed Jobs</Text>
            </View>

            <TouchableOpacity
              style={styles.statBox}
              onPress={() => navigation.navigate('Reviews')}
              activeOpacity={0.7}
            >
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={styles.statVal}>
                  {profile?.rating?.average
                    ? Number(profile.rating.average).toFixed(1)
                    : typeof profile?.rating === 'number' && profile.rating > 0
                      ? Number(profile.rating).toFixed(1)
                      : '5.0'}
                </Text>
              </View>
              <Text style={styles.statLabel}>Rating</Text>
            </TouchableOpacity>

            <View style={styles.statBox}>
              <Text style={styles.statVal}>{profile?.experienceYears || 1}+ yrs</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          </View>
        </Card>

        {/* Business Info */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Contact Phone</Text>
            <Text style={styles.val}>{profile?.user?.phone || user?.phone || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Account Role</Text>
            <Text style={styles.val}>Verified Provider</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.categoriesRow}>
            <Text style={styles.label}>Service Categories</Text>
            <View style={styles.categoryPillsWrapper}>
              {Array.isArray(profile?.categories) && profile.categories.length > 0 ? (
                profile.categories.map((cat, idx) => (
                  <View key={cat?._id || cat || idx} style={styles.categoryPill}>
                    <Ionicons name="pricetag" size={11} color="#A78BFA" style={{ marginRight: 4 }} />
                    <Text style={styles.categoryPillText}>
                      {typeof cat === 'object' && cat !== null ? (cat.name || 'Category') : 'Service Category'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noCategoriesText}>None specified</Text>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Availability Status</Text>
            <Badge
              label={profile?.isAvailable ? 'AVAILABLE' : 'OFFLINE'}
              variant={profile?.isAvailable ? 'success' : 'slate'}
              size="sm"
            />
          </View>
        </Card>

        {/* MENDROO Provider Support Helpline Card */}
        <SupportContactCard />

        {/* Support & Complaints Navigation */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('Support')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E1065' : '#EDE9FE' }]}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={isDark ? '#C4B5FD' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1} ellipsizeMode="tail">Support & Complaints</Text>
                <Text style={styles.navSub} numberOfLines={1} ellipsizeMode="tail">Dispute resolution, partner care & FAQs</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </Card>

        {/* Appearance & Theme Settings */}
        <Card style={styles.card}>
          <AppearanceSettings />
        </Card>

        {/* Legal & Policies */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Legal & Policies</Text>

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ProviderTerms')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E1065' : '#EDE9FE' }]}>
                <Ionicons name="document-text-outline" size={18} color={isDark ? '#C4B5FD' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1} ellipsizeMode="tail">Provider Terms & Conditions</Text>
                <Text style={styles.navSub} numberOfLines={1} ellipsizeMode="tail">v{CURRENT_TERMS_VERSION} • Effective: {TERMS_EFFECTIVE_DATE}</Text>
              </View>
            </View>
            <View style={styles.navRight}>
              <Badge
                label={profile?.acceptedTermsVersion === CURRENT_TERMS_VERSION ? 'ACCEPTED' : 'PENDING'}
                variant={profile?.acceptedTermsVersion === CURRENT_TERMS_VERSION ? 'success' : 'warning'}
                size="sm"
              />
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>

          {profile?.acceptedTermsAt && (
            <View style={[styles.row, { marginTop: spacing.sm, paddingTop: spacing.xs }]}>
              <Text style={styles.label}>Accepted On</Text>
              <Text style={styles.val}>
                {new Date(profile.acceptedTermsAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => Linking.openURL('https://service-provider-marketplace.onrender.com/privacy/provider')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E1065' : '#EDE9FE' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={isDark ? '#C4B5FD' : colors.primary} />
              </View>
              <View style={styles.navTextCol}>
                <Text style={styles.navLabel} numberOfLines={1} ellipsizeMode="tail">Provider Privacy Policy</Text>
                <Text style={styles.navSub} numberOfLines={1} ellipsizeMode="tail">Data collection, security & transparency</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => Linking.openURL('https://service-provider-marketplace.onrender.com/delete-account/provider')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#4C0519' : '#FEE2E2' }]}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </View>
              <View style={styles.navTextCol}>
                <Text style={[styles.navLabel, { color: '#EF4444' }]} numberOfLines={1} ellipsizeMode="tail">Account Deletion Policy & Web Request</Text>
                <Text style={styles.navSub} numberOfLines={1} ellipsizeMode="tail">Google Play Store user data compliance</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </Card>

        {/* Application Information */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Application Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Portal Version</Text>
            <Text style={styles.val}>1.0.0 (Phase 11)</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.row, { alignItems: 'flex-start' }]}>
            <Text style={[styles.label, { flexShrink: 0, marginRight: spacing.sm, marginTop: 2 }]}>API Endpoint</Text>
            <Text style={[styles.val, styles.apiVal]} selectable>
              {API_CONFIG.BASE_URL}
            </Text>
          </View>
        </Card>

        <Button
          title={loggingOut ? "Signing Out..." : "Sign Out"}
          onPress={handleLogout}
          variant="danger"
          loading={loggingOut}
          disabled={loggingOut}
          style={styles.logoutBtn}
        />

        {/* Account Deletion Trigger */}
        <TouchableOpacity
          style={styles.deleteAccountTrigger}
          onPress={() => setIsDeleteModalOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.deleteAccountTriggerText}>Delete Provider Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Provider Profile</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {errorMsg && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              <Input
                label="Business / Trade Name *"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Apex Home Services"
              />

              <Input
                label="Contact Phone *"
                value={phone}
                onChangeText={setPhone}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
              />

              <Input
                label="Years of Experience *"
                value={experienceYears}
                onChangeText={setExperienceYears}
                placeholder="e.g. 5"
                keyboardType="numeric"
              />

              <Input
                label="Professional Bio"
                value={bio}
                onChangeText={setBio}
                placeholder="Brief summary of your skills and service focus..."
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsAvailable(!isAvailable)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isAvailable ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isAvailable ? '#7C3AED' : '#71717A'}
                />
                <Text style={styles.checkboxText}>Mark account as Available for jobs</Text>
              </TouchableOpacity>

              <Button
                title="Save Profile"
                onPress={handleSaveProfile}
                loading={saving}
                disabled={saving}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Permanent Provider Account Deletion Confirmation Modal */}
      <Modal
        visible={isDeleteModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => !deletingAccount && setIsDeleteModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.deleteAccountModalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.deleteAccountModalContent}>
              <View style={styles.deleteAccountIconCircle}>
                <Ionicons name="warning-outline" size={32} color="#EF4444" />
              </View>
              <Text style={styles.deleteAccountTitle}>Permanent Account Deletion</Text>
              <Text style={styles.deleteAccountSubtitle}>
                Google Play Store User Data Compliance
              </Text>

              <View style={styles.disclosureCard}>
                <Text style={styles.disclosureHeading}>Data that will be permanently erased:</Text>
                <Text style={styles.disclosureText}>• Your business name, contact phone, and email address</Text>
                <Text style={styles.disclosureText}>• KYC documents and bank account payout information</Text>
                <Text style={styles.disclosureText}>• Custom offered services and push notification tokens</Text>
              </View>

              <View style={[styles.disclosureCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                <Text style={[styles.disclosureHeading, { color: '#F87171' }]}>Data legally retained:</Text>
                <Text style={styles.disclosureText}>• Completed service transactions, past customer reviews, and tax commission ledgers will be retained in an anonymized format as required by Indian commercial & tax statutes.</Text>
              </View>

              <Input
                label="Confirm with Password (Optional)"
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Enter password to verify"
                secureTextEntry
                containerStyle={{ width: '100%', marginTop: spacing.sm, marginBottom: spacing.md }}
              />

              <View style={styles.deleteAccountBtnRow}>
                <Button
                  title="Cancel"
                  onPress={() => setIsDeleteModalOpen(false)}
                  disabled={deletingAccount}
                  variant="secondary"
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <Button
                  title={deletingAccount ? "Deleting..." : "Delete Account"}
                  onPress={handleDeleteAccount}
                  loading={deletingAccount}
                  disabled={deletingAccount}
                  variant="danger"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    padding: spacing.lg
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    marginBottom: spacing.lg
  },
  pendingCard: {
    backgroundColor: isDark ? '#351F0B' : '#FEF3C7',
    borderColor: isDark ? '#78350F' : '#FCD34D',
    borderWidth: 1
  },
  rejectedCard: {
    backgroundColor: isDark ? '#3C0F17' : '#FEE2E2',
    borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
    borderWidth: 1
  },
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  statusBannerTitle: {
    ...typography.titleSmall,
    fontWeight: '700'
  },
  statusBannerDesc: {
    ...typography.caption,
    marginTop: 2,
    lineHeight: 16
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  avatarContainer: {
    position: 'relative'
  },
  avatarImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.cardSecondary
  },
  avatarPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: isDark ? '#1F1B2E' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 33,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1
  },
  name: {
    ...typography.titleSmall,
    color: colors.textPrimary
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 2
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: 8,
    backgroundColor: isDark ? '#1F1A2E' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md
  },
  editProfileBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700'
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    width: '100%'
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.xs
  },
  navTextCol: {
    flex: 1,
    minWidth: 0
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? '#1F1A2E' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  navSub: {
    ...typography.caption,
    color: colors.textSecondary
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.md
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.cardSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4
  },
  statVal: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    width: '100%'
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  val: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500'
  },
  apiVal: {
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
    ...(Platform.OS === 'web' ? { wordBreak: 'break-all' } : {})
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs
  },
  logoutBtn: {
    marginTop: spacing.sm
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  modalTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  checkboxText: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  errorBox: {
    backgroundColor: isDark ? '#4C0519' : '#FEE2E2',
    borderWidth: 1,
    borderColor: isDark ? '#991B1B' : '#FCA5A5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: isDark ? '#F87171' : '#B91C1C'
  },
  kycActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    gap: 6
  },
  kycActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  kycNavBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  kycNavBadgeVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)'
  },
  kycNavBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)'
  },
  kycNavBadgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)'
  },
  kycNavBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: isDark ? '#E5E7EB' : '#374151'
  },
  categoriesRow: {
    paddingVertical: spacing.xs,
    gap: 6
  },
  categoryPillsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(167, 139, 250, 0.35)' : 'rgba(124, 58, 237, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  categoryPillText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 11
  },
  noCategoriesText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontStyle: 'italic'
  },
  deleteAccountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
    paddingVertical: 12
  },
  deleteAccountTriggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444'
  },
  deleteAccountModalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  deleteAccountModalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: spacing.xl,
    alignItems: 'center'
  },
  deleteAccountIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  deleteAccountTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4
  },
  deleteAccountSubtitle: {
    fontSize: 12,
    color: colors.textSecondary || '#9CA3AF',
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  disclosureCard: {
    width: '100%',
    backgroundColor: isDark ? '#1C1929' : '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  disclosureHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  disclosureText: {
    fontSize: 11,
    color: colors.textSecondary || '#9CA3AF',
    lineHeight: 16,
    marginBottom: 2
  },
  deleteAccountBtnRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: spacing.sm
  }
});
