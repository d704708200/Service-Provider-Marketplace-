import React, { useState, useEffect, useCallback } from 'react';
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
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { providerApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import { getApiBaseUrl, API_CONFIG } from '../../config/env';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile: authProfile, logout, checkAuthSession } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [loggingOut, setLoggingOut] = useState(false);

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

  const verificationStatus = profile?.verificationStatus || 'pending';

  return (
    <View style={styles.container}>
      <Header
        title="Provider Account"
        subtitle="Business Profile & Settings"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
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
                    ? (profile?.kycStatus === 'under_review'
                      ? 'Platform administrators are reviewing your KYC documents (Aadhaar & PAN). Once verified, you will be eligible for customer bookings.'
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
                    {profile?.kycStatus === 'under_review' ? 'View KYC Status' : 'Complete KYC Verification'}
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
            onPress={() => navigation.navigate('Availability')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={18} color="#A78BFA" />
              </View>
              <View>
                <Text style={styles.navLabel}>Weekly Availability Schedule</Text>
                <Text style={styles.navSub}>Set working hours for each day</Text>
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
                <Ionicons name="map-outline" size={18} color="#A78BFA" />
              </View>
              <View>
                <Text style={styles.navLabel}>Service Areas & Zip Codes</Text>
                <Text style={styles.navSub}>Manage coverage territories</Text>
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
              <View style={[styles.iconCircle, { backgroundColor: '#2E1065' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#C4B5FD" />
              </View>
              <View>
                <Text style={styles.navLabel}>KYC Verification</Text>
                <Text style={styles.navSub}>Aadhaar & PAN document compliance</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[
                styles.kycNavBadge,
                verificationStatus === 'verified' ? styles.kycNavBadgeVerified :
                verificationStatus === 'rejected' ? styles.kycNavBadgeRejected :
                styles.kycNavBadgePending
              ]}>
                <Text style={styles.kycNavBadgeText}>
                  {verificationStatus.toUpperCase()}
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
                <Ionicons name="pricetag-outline" size={18} color="#A78BFA" />
              </View>
              <View>
                <Text style={styles.navLabel}>Services & Pricing Catalog</Text>
                <Text style={styles.navSub}>Configure service offerings & rates</Text>
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

            <View style={styles.statBox}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={15} color="#F59E0B" />
                <Text style={styles.statVal}>
                  {profile?.rating?.average ? Number(profile.rating.average).toFixed(1) : '5.0'}
                </Text>
              </View>
              <Text style={styles.statLabel}>Rating</Text>
            </View>

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

        {/* Application Information */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Application Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Portal Version</Text>
            <Text style={styles.val}>1.0.0 (Phase 11)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>API Endpoint</Text>
            <Text style={styles.val} numberOfLines={1}>
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
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scroll: {
    padding: spacing.lg
  },
  card: {
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderRadius: 16,
    marginBottom: spacing.lg
  },
  pendingCard: {
    backgroundColor: '#351F0B',
    borderColor: '#78350F',
    borderWidth: 1
  },
  rejectedCard: {
    backgroundColor: '#3C0F17',
    borderColor: '#7F1D1D',
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
    borderColor: '#8B5CF6',
    backgroundColor: '#1F1B2E'
  },
  avatarPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1F1B2E',
    borderWidth: 1,
    borderColor: '#362E52',
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
    backgroundColor: '#7C3AED',
    borderWidth: 2,
    borderColor: '#161420',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1
  },
  name: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  email: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginBottom: 2
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#1F1A2E',
    borderWidth: 1,
    borderColor: '#31284F',
    borderRadius: borderRadius.md
  },
  editProfileBtnText: {
    ...typography.bodySmall,
    color: '#A78BFA',
    fontWeight: '700'
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F1A2E',
    borderWidth: 1,
    borderColor: '#2F264A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navLabel: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600'
  },
  navSub: {
    ...typography.caption,
    color: '#9CA3AF'
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
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
    backgroundColor: '#1C1929',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#252136',
    marginHorizontal: 4
  },
  statVal: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  statLabel: {
    ...typography.caption,
    color: '#9CA3AF',
    marginTop: 2
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  label: {
    ...typography.bodySmall,
    color: '#9CA3AF'
  },
  val: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#252136',
    marginVertical: spacing.xs
  },
  logoutBtn: {
    marginTop: spacing.sm
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
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
    color: '#FFFFFF'
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  checkboxText: {
    ...typography.bodySmall,
    color: '#E2E8F0'
  },
  errorBox: {
    backgroundColor: '#4C0519',
    borderWidth: 1,
    borderColor: '#991B1B',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: '#F87171'
  },
  kycActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
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
    color: '#E5E7EB'
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
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  categoryPillText: {
    ...typography.caption,
    color: '#DDD6FE',
    fontWeight: '600',
    fontSize: 11
  },
  noCategoriesText: {
    ...typography.bodySmall,
    color: '#6B7280',
    fontStyle: 'italic'
  }
});
