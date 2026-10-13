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
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { providerApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, profile: authProfile, logout, checkAuthSession } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() }
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
                color={verificationStatus === 'pending' ? '#D97706' : '#DC2626'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.statusBannerTitle,
                    { color: verificationStatus === 'pending' ? '#92400E' : '#991B1B' }
                  ]}
                >
                  {verificationStatus === 'pending'
                    ? 'Account Verification Under Review'
                    : 'Account Verification Action Required'}
                </Text>
                <Text
                  style={[
                    styles.statusBannerDesc,
                    { color: verificationStatus === 'pending' ? '#B45309' : '#B91C1C' }
                  ]}
                >
                  {verificationStatus === 'pending'
                    ? 'Platform administrators are reviewing your documents. Once verified, you will be eligible for customer bookings.'
                    : profile?.rejectionReason || 'Please review your uploaded documents or contact support.'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Profile Card */}
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Ionicons name="business" size={32} color={colors.primary} />
            </View>
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
                style={{ marginTop: 4 }}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={handleOpenEdit}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
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
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.navLabel}>Weekly Availability Schedule</Text>
                <Text style={styles.navSub}>Set working hours for each day</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('ServiceAreas')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <Ionicons name="map-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.navLabel}>Service Areas & Zip Codes</Text>
                <Text style={styles.navSub}>Manage coverage territories</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => navigation.navigate('OfferedServices')}
            activeOpacity={0.7}
          >
            <View style={styles.navLeft}>
              <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.navLabel}>Services & Pricing Catalog</Text>
                <Text style={styles.navSub}>Configure service offerings & rates</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.slate400} />
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
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.statVal}>
                  {profile?.rating?.average ? profile.rating.average.toFixed(1) : '5.0'}
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
          <View style={styles.row}>
            <Text style={styles.label}>Availability Status</Text>
            <Badge
              label={profile?.isAvailable ? 'AVAILABLE' : 'OFFLINE'}
              variant={profile?.isAvailable ? 'success' : 'slate'}
              size="sm"
            />
          </View>
        </Card>

        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="danger"
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
                  <Ionicons name="close" size={24} color={colors.slate600} />
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
                  color={isAvailable ? colors.primary : colors.slate400}
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
    backgroundColor: colors.background
  },
  scroll: {
    padding: spacing.lg
  },
  card: {
    marginBottom: spacing.lg
  },
  pendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1
  },
  rejectedCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
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
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCol: {
    flex: 1
  },
  name: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  email: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginBottom: 2
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySubtle,
    borderRadius: borderRadius.md
  },
  editProfileBtnText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
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
  navLabel: {
    ...typography.bodyMedium,
    color: colors.slate900,
    fontWeight: '600'
  },
  navSub: {
    ...typography.caption,
    color: colors.slate500
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
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
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    marginHorizontal: 4
  },
  statVal: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  statLabel: {
    ...typography.caption,
    color: colors.slate500,
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
    color: colors.slate500
  },
  val: {
    ...typography.bodySmall,
    color: colors.slate800,
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginVertical: spacing.xs
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
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
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
    color: colors.slate900
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  checkboxText: {
    ...typography.bodySmall,
    color: colors.slate700
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: '#B91C1C'
  }
});
