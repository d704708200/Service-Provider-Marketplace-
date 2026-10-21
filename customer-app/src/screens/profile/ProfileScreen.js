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
  TextInput,
  ActivityIndicator,
  Platform,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, checkAuthSession } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile data from /api/customers/me
  const [customerData, setCustomerData] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // Helper to format avatar URL with full backend base URL for relative paths
  const getFullAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    let url = avatarPath;
    if (url.startsWith('/')) {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
        : 'http://localhost:5000';
      url = `${baseUrl}${url}`;
    }
    // Append cache buster to prevent stale image caching
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
          'Photo library access is required to update your profile photo. Please enable it in system settings.'
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
        return; // User cancelled
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
      const safeFilename = `avatar_${Date.now()}.${cleanExt}`;
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
      const res = await customerApi.uploadAvatar(formData);

      if (res?.success && res.data) {
        setCustomerData(res.data);
        setCacheBuster(Date.now());
        await checkAuthSession();
        Alert.alert('Success', 'Profile photo updated successfully!');
      } else {
        Alert.alert('Upload Failed', res?.message || 'Could not update profile photo.');
      }
    } catch (err) {
      console.error('Customer photo upload error:', err);
      Alert.alert(
        'Upload Failed',
        err.userMessage || err.message || 'An error occurred while uploading your profile photo.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [savingProfile, setSavingProfile] = useState(false);

  // Address Modal State (Add or Edit)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [addrTitle, setAddrTitle] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState(null);

  const fetchProfileAndAddresses = useCallback(async () => {
    setError(null);
    try {
      const res = await customerApi.getProfile();
      if (res?.success && res.data) {
        setCustomerData(res.data);
        setAddresses(res.data.addresses || []);
      }
    } catch (err) {
      setError(err.userMessage || 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileAndAddresses();
  }, [fetchProfileAndAddresses]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([checkAuthSession(), fetchProfileAndAddresses()]);
    setRefreshing(false);
  };

  const handleOpenEditProfile = () => {
    setEditName(customerData?.user?.name || user?.name || '');
    setEditPhone(customerData?.user?.phone || user?.phone || '');
    setEditPaymentMethod(customerData?.defaultPaymentMethod || 'cash');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      Alert.alert('Validation Error', 'Name must be at least 2 characters.');
      return;
    }
    if (!editPhone.trim() || editPhone.trim().length < 7) {
      Alert.alert('Validation Error', 'Please enter a valid phone number (min 7 digits).');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await customerApi.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        defaultPaymentMethod: editPaymentMethod
      });
      if (res?.success) {
        setCustomerData(res.data);
        setIsEditProfileOpen(false);
        Alert.alert('Success', 'Profile updated successfully.');
        await checkAuthSession();
      }
    } catch (err) {
      Alert.alert('Update Failed', err.userMessage || err.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenAddAddress = () => {
    setSelectedAddressId(null);
    setAddrTitle('Home');
    setAddrStreet('');
    setAddrCity('');
    setAddrState('');
    setAddrZip('');
    setAddrIsDefault(addresses.length === 0);
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr) => {
    setSelectedAddressId(addr._id);
    setAddrTitle(addr.title || 'Home');
    setAddrStreet(addr.street || '');
    setAddrCity(addr.city || '');
    setAddrState(addr.state || '');
    setAddrZip(addr.zipCode || '');
    setAddrIsDefault(Boolean(addr.isDefault));
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!addrStreet.trim()) {
      setAddressError('Street address is required.');
      return;
    }
    if (!addrCity.trim()) {
      setAddressError('City is required.');
      return;
    }

    setSavingAddress(true);
    setAddressError(null);
    try {
      const payload = {
        title: addrTitle.trim() || 'Home',
        street: addrStreet.trim(),
        city: addrCity.trim(),
        state: addrState.trim(),
        zipCode: addrZip.trim(),
        isDefault: addrIsDefault
      };

      let res;
      if (selectedAddressId) {
        res = await customerApi.updateAddress(selectedAddressId, payload);
      } else {
        res = await customerApi.addAddress(payload);
      }

      if (res?.success) {
        setAddresses(res.data || []);
        setIsAddressModalOpen(false);
        Alert.alert(
          'Success',
          selectedAddressId ? 'Address updated successfully.' : 'Address added successfully.'
        );
      }
    } catch (err) {
      setAddressError(err.userMessage || err.message || 'Failed to save address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = (addressId) => {
    Alert.alert('Delete Address', 'Are you sure you want to remove this saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await customerApi.deleteAddress(addressId);
            if (res?.success) {
              setAddresses(res.data || []);
            }
          } catch (err) {
            Alert.alert('Error', err.userMessage || 'Failed to delete address.');
          }
        }
      }
    ]);
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const res = await customerApi.setDefaultAddress(addressId);
      if (res?.success) {
        setAddresses(res.data || []);
      }
    } catch (err) {
      Alert.alert('Error', err.userMessage || 'Failed to set default address.');
    }
  };

  const performLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      Alert.alert('Sign Out Failed', err.message || 'Could not complete sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to log out of your account?')
        : true;
      if (confirmed) {
        performLogout();
      }
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: performLogout
      }
    ]);
  };

  const memberSince = (customerData?.user?.createdAt || user?.createdAt)
    ? new Date(customerData?.user?.createdAt || user?.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      })
    : 'Recently';

  return (
    <View style={styles.container}>
      <Header
        title="My Account"
        subtitle="Profile & Saved Addresses"
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={styles.userRow}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickAndUploadPhoto}
              activeOpacity={0.8}
              disabled={uploadingPhoto}
            >
              {(() => {
                const avatarUrl = getFullAvatarUrl(customerData?.user?.avatar || user?.avatar);
                if (avatarUrl) {
                  return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
                }
                return (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={32} color={colors.primary} />
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

            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {customerData?.user?.name || user?.name || 'Customer'}
                </Text>
                <Badge label="Customer" variant="primary" size="sm" />
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>
                {customerData?.user?.email || user?.email}
              </Text>
              <Text style={styles.userPhone}>
                {customerData?.user?.phone || user?.phone || 'No phone set'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={handleOpenEditProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </Card>

        {/* Account Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="mail-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Email</Text>
            </View>
            <Text style={styles.detailValue}>{customerData?.user?.email || user?.email}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="call-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Phone</Text>
            </View>
            <Text style={styles.detailValue}>
              {customerData?.user?.phone || user?.phone || 'Not provided'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="card-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Preferred Payment</Text>
            </View>
            <Text style={styles.detailValue}>
              {(customerData?.defaultPaymentMethod || 'cash').toUpperCase()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="calendar-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Member Since</Text>
            </View>
            <Text style={styles.detailValue}>{memberSince}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.slate400} />
              <Text style={styles.detailLabel}>Account Status</Text>
            </View>
            <Badge label="Active" variant="success" size="sm" />
          </View>
        </Card>

        {/* Saved Addresses Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            <TouchableOpacity
              style={styles.addAddressBtn}
              onPress={handleOpenAddAddress}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <Text style={styles.addAddressText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : addresses && addresses.length > 0 ? (
            addresses.map((addr) => (
              <View key={addr._id} style={styles.addressBox}>
                <View style={styles.addressTopRow}>
                  <View style={styles.addressTitleRow}>
                    <Ionicons
                      name={addr.title?.toLowerCase() === 'work' ? 'briefcase-outline' : 'home-outline'}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.addressTitle}>{addr.title || 'Address'}</Text>
                    {addr.isDefault && <Badge label="DEFAULT" variant="primary" size="sm" />}
                  </View>

                  <View style={styles.addressActions}>
                    {!addr.isDefault && (
                      <TouchableOpacity
                        onPress={() => handleSetDefaultAddress(addr._id)}
                        style={styles.actionIconBtn}
                        title="Set as Default"
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.slate500} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => handleOpenEditAddress(addr)}
                      style={styles.actionIconBtn}
                    >
                      <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteAddress(addr._id)}
                      style={styles.actionIconBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error || '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.addressStreet}>{addr.street}</Text>
                <Text style={styles.addressCity}>
                  {addr.city}
                  {addr.state ? `, ${addr.state}` : ''}
                  {addr.zipCode ? ` - ${addr.zipCode}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyAddress}>
              <Ionicons name="location-outline" size={24} color={colors.slate400} />
              <Text style={styles.emptyAddressText}>
                No saved address yet. Add a default address for faster checkouts.
              </Text>
            </View>
          )}
        </Card>

        {/* Application Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Application Information</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Marketplace Version</Text>
            <Text style={styles.detailValue}>1.0.0 (Phase 11)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>API Endpoint</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api'}
            </Text>
          </View>
        </Card>

        {/* Sign Out Button */}
        <Button
          title={loggingOut ? 'Signing Out...' : 'Sign Out'}
          onPress={handleLogout}
          variant="danger"
          loading={loggingOut}
          disabled={loggingOut}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditProfileOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditProfileOpen(false)}>
                <Ionicons name="close" size={24} color={colors.slate600} />
              </TouchableOpacity>
            </View>

            <Input
              label="Full Name *"
              value={editName}
              onChangeText={setEditName}
              placeholder="Your Name"
            />

            <Input
              label="Phone Number *"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
            />

            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.inputLabel}>Preferred Payment Method</Text>
              <View style={styles.paymentToggleRow}>
                {['cash', 'card', 'upi', 'wallet'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.paymentMethodTab,
                      editPaymentMethod === method && styles.paymentMethodTabActive
                    ]}
                    onPress={() => setEditPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.paymentMethodText,
                        editPaymentMethod === method && styles.paymentMethodTextActive
                      ]}
                    >
                      {method.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Button
              title="Save Profile"
              onPress={handleSaveProfile}
              loading={savingProfile}
              disabled={savingProfile}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      {/* Add / Edit Address Modal */}
      <Modal visible={isAddressModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedAddressId ? 'Edit Address' : 'Add Saved Address'}
                </Text>
                <TouchableOpacity onPress={() => setIsAddressModalOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.slate600} />
                </TouchableOpacity>
              </View>

              {addressError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{addressError}</Text>
                </View>
              )}

              <Input
                label="Address Label (e.g. Home, Work, Parents)"
                value={addrTitle}
                onChangeText={setAddrTitle}
                placeholder="Home"
              />

              <Input
                label="Street Address *"
                value={addrStreet}
                onChangeText={setAddrStreet}
                placeholder="Flat / House No, Street name"
              />

              <Input
                label="City *"
                value={addrCity}
                onChangeText={setAddrCity}
                placeholder="Mumbai"
              />

              <View style={styles.row}>
                <View style={styles.halfCol}>
                  <Input
                    label="State"
                    value={addrState}
                    onChangeText={setAddrState}
                    placeholder="Maharashtra"
                  />
                </View>
                <View style={styles.halfCol}>
                  <Input
                    label="PIN / Zip Code"
                    value={addrZip}
                    onChangeText={setAddrZip}
                    placeholder="400001"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.defaultCheckboxRow}
                onPress={() => setAddrIsDefault(!addrIsDefault)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={addrIsDefault ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={addrIsDefault ? colors.primary : colors.slate400}
                />
                <Text style={styles.defaultCheckboxText}>Set as primary default address</Text>
              </TouchableOpacity>

              <Button
                title={selectedAddressId ? 'Update Address' : 'Save Address'}
                onPress={handleSaveAddress}
                loading={savingAddress}
                disabled={savingAddress}
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
  scrollContent: {
    padding: spacing.lg
  },
  profileCard: {
    marginBottom: spacing.lg,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1,
    borderRadius: 16
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.lg
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    backgroundColor: '#1E1B2E'
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#36314D'
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
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
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#161420',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2
  },
  userName: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    flex: 1,
    marginRight: spacing.sm
  },
  userEmail: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginBottom: 2
  },
  userPhone: {
    ...typography.caption,
    color: '#71717A'
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#36314D',
    backgroundColor: '#241F36',
    borderRadius: borderRadius.md
  },
  editProfileButtonText: {
    ...typography.bodySmall,
    color: '#C084FC',
    fontWeight: '600'
  },
  sectionCard: {
    marginBottom: spacing.lg,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1,
    borderRadius: 16
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  addAddressText: {
    ...typography.bodySmall,
    color: '#8B5CF6',
    fontWeight: '600'
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: '#9CA3AF'
  },
  detailValue: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#252136',
    marginVertical: spacing.sm
  },
  addressBox: {
    backgroundColor: '#1C1929',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#2D2742'
  },
  addressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  addressTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  actionIconBtn: {
    padding: 4
  },
  addressStreet: {
    ...typography.bodyMedium,
    color: '#E2E8F0',
    marginTop: 2
  },
  addressCity: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginTop: 2
  },
  emptyAddress: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md
  },
  emptyAddressText: {
    ...typography.bodySmall,
    color: colors.slate500,
    textAlign: 'center',
    lineHeight: 18
  },
  logoutBtn: {
    marginTop: spacing.sm
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#252136'
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
  inputLabel: {
    ...typography.caption,
    color: '#CBD5E1',
    fontWeight: '600',
    marginBottom: 6
  },
  paymentToggleRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  paymentMethodTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#2D2742',
    backgroundColor: '#1C1929'
  },
  paymentMethodTabActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#2E1065'
  },
  paymentMethodText: {
    ...typography.caption,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  paymentMethodTextActive: {
    color: '#DDD6FE',
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  halfCol: {
    flex: 1
  },
  defaultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  defaultCheckboxText: {
    ...typography.bodySmall,
    color: colors.slate700
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: '#B91C1C'
  }
});
