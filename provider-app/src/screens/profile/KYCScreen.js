import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { providerApi } from '../../services/api';
import { Card, Button, Header } from '../../components/common';
import API_CONFIG from '../../config/env';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function KYCScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, profile: authProfile, checkAuthSession } = useAuth();
  const [profile, setProfile] = useState(authProfile);

  // KYC Document states
  const [aadhaarFront, setAadhaarFront] = useState(profile?.aadhaarFrontImage || null);
  const [aadhaarBack, setAadhaarBack] = useState(profile?.aadhaarBackImage || null);
  const [panFront, setPanFront] = useState(profile?.panFrontImage || null);
  const [panBack, setPanBack] = useState(profile?.panBackImage || null);

  // Uploading state per card
  const [uploadingField, setUploadingField] = useState(null); // 'aadhaar_front' | 'aadhaar_back' | 'pan_front' | 'pan_back'
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Review modal before final submission
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  useEffect(() => {
    providerApi.getProfile()
      .then((res) => {
        if (res?.data) {
          setProfile(res.data);
          if (res.data.aadhaarFrontImage) setAadhaarFront(res.data.aadhaarFrontImage);
          if (res.data.aadhaarBackImage) setAadhaarBack(res.data.aadhaarBackImage);
          if (res.data.panFrontImage) setPanFront(res.data.panFrontImage);
          if (res.data.panBackImage) setPanBack(res.data.panBackImage);
        }
      })
      .catch(() => {});
  }, []);

  const resolveImageUrl = (pathOrUrl) => {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const base = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');
    return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  };

  const handlePickDocument = async (field, source = 'library') => {
    setErrorMsg(null);

    try {
      let result;
      if (source === 'camera') {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert('Permission Denied', 'Camera permission is required to photograph your document.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.8
        });
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert('Permission Denied', 'Media library permission is required to select your document.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert('Error', 'Unable to load the selected file.');
        return;
      }

      setUploadingField(field);

      // Prepare Multipart FormData
      const formData = new FormData();
      const uri = asset.uri;
      const cleanExt = (asset.mimeType?.includes('png') || uri.endsWith('.png')) ? 'png' : 'jpg';
      const safeFilename = `${field}_${Date.now()}.${cleanExt}`;
      const safeMimeType = asset.mimeType || (cleanExt === 'png' ? 'image/png' : 'image/jpeg');

      formData.append('docType', field);

      if (Platform.OS === 'web') {
        if (asset.file instanceof Blob) {
          formData.append('document', asset.file, safeFilename);
        } else {
          const fetchRes = await fetch(uri);
          const blob = await fetchRes.blob();
          const file = new File([blob], safeFilename, { type: safeMimeType });
          formData.append('document', file, safeFilename);
        }
      } else {
        formData.append('document', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: safeFilename,
          type: safeMimeType
        });
      }

      const res = await providerApi.uploadKYCDocument(formData);
      if (res?.success && res.data?.documentUrl) {
        const uploadedUrl = res.data.documentUrl;
        if (field === 'aadhaar_front') setAadhaarFront(uploadedUrl);
        else if (field === 'aadhaar_back') setAadhaarBack(uploadedUrl);
        else if (field === 'pan_front') setPanFront(uploadedUrl);
        else if (field === 'pan_back') setPanBack(uploadedUrl);

        setSuccessMsg(`${formatFieldLabel(field)} uploaded successfully!`);
      } else {
        Alert.alert('Upload Failed', res?.message || 'Could not upload document.');
      }
    } catch (err) {
      console.error('KYC file upload error:', err);
      Alert.alert(
        'Upload Error',
        err.userMessage || err.message || 'Failed to upload document. Please ensure file size is under 5MB.'
      );
    } finally {
      setUploadingField(null);
    }
  };

  const handleSelectSource = (field) => {
    if (Platform.OS === 'web') {
      handlePickDocument(field, 'library');
      return;
    }

    Alert.alert(
      `Upload ${formatFieldLabel(field)}`,
      'Choose image source:',
      [
        { text: 'Camera', onPress: () => handlePickDocument(field, 'camera') },
        { text: 'Photo Gallery', onPress: () => handlePickDocument(field, 'library') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const formatFieldLabel = (field) => {
    switch (field) {
      case 'aadhaar_front': return 'Aadhaar Card (Front)';
      case 'aadhaar_back': return 'Aadhaar Card (Back)';
      case 'pan_front': return 'PAN Card (Front)';
      case 'pan_back': return 'PAN Card (Back)';
      default: return 'Document';
    }
  };

  const validateKYCPackage = () => {
    if (!aadhaarFront) {
      Alert.alert('Missing Document', 'Aadhaar Card Front photo is required.');
      return false;
    }
    if (!aadhaarBack) {
      Alert.alert('Missing Document', 'Aadhaar Card Back photo is required.');
      return false;
    }
    if (!panFront) {
      Alert.alert('Missing Document', 'PAN Card Front photo is required.');
      return false;
    }
    // PAN back is required by default
    if (!panBack) {
      Alert.alert('Missing Document', 'PAN Card Back photo is required.');
      return false;
    }
    return true;
  };

  const handleReviewAndSubmit = () => {
    if (!validateKYCPackage()) return;
    setReviewModalVisible(true);
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await providerApi.submitKYCDocuments({
        aadhaarFrontImage: aadhaarFront,
        aadhaarBackImage: aadhaarBack,
        panFrontImage: panFront,
        panBackImage: panBack
      });

      if (res?.success) {
        setProfile(res.data);
        await checkAuthSession();
        setReviewModalVisible(false);
        Alert.alert(
          'Verification Submitted',
          'Your KYC documents have been submitted for review. Once verified by our administration, your profile will be activated for customer bookings.'
        );
      }
    } catch (err) {
      setErrorMsg(err.userMessage || err.message || 'Submission failed. Please check your documents.');
    } finally {
      setSubmitting(false);
    }
  };

  const kycStatus = profile?.kycStatus || profile?.verificationStatus || 'pending';

  return (
    <View style={styles.container}>
      <Header
        title="KYC Verification"
        subtitle="Identity & Document Compliance"
        showBack={Boolean(navigation?.canGoBack())}
        onBack={() => navigation?.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xxl }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View style={[
          styles.statusCard,
          kycStatus === 'verified' ? styles.statusVerified :
          kycStatus === 'rejected' ? styles.statusRejected :
          styles.statusPending
        ]}>
          <Ionicons
            name={
              kycStatus === 'verified' ? 'checkmark-circle' :
              kycStatus === 'rejected' ? 'close-circle' :
              'time-outline'
            }
            size={24}
            color={
              kycStatus === 'verified' ? '#10B981' :
              kycStatus === 'rejected' ? '#EF4444' :
              '#F59E0B'
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.statusTitle,
              {
                color: kycStatus === 'verified' ? '#34D399' :
                       kycStatus === 'rejected' ? '#F87171' :
                       '#FBBF24'
              }
            ]}>
              {kycStatus === 'verified' ? 'KYC Verified & Approved' :
               kycStatus === 'rejected' ? 'KYC Verification Rejected' :
               kycStatus === 'under_review' ? 'Verification Under Review' :
               'KYC Documents Required'}
            </Text>
            <Text style={styles.statusDesc}>
              {kycStatus === 'verified'
                ? 'Your identity documents are verified. You can receive customer bookings.'
                : kycStatus === 'rejected'
                ? (profile?.kycRejectionReason || profile?.rejectionReason || 'Please upload clear and valid replacement photos.')
                : 'Upload clear, readable photos of both sides of your Aadhaar Card and PAN Card.'}
            </Text>
          </View>
        </View>

        {errorMsg ? (
          <View style={styles.alertBannerError}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertTextError}>{errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={styles.alertBannerSuccess}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.alertTextSuccess}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Section 1: Aadhaar Card */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>Step 1</Text>
          </View>
          <Text style={styles.sectionHeading}>Aadhaar Card Photos</Text>
        </View>
        <Text style={styles.sectionSub}>Both front and back sides are mandatory. Ensure all 4 corners and details are readable.</Text>

        <View style={styles.docRow}>
          {/* Aadhaar Front */}
          <DocumentCard
            title="Aadhaar Front"
            required={true}
            imageUri={resolveImageUrl(aadhaarFront)}
            isUploading={uploadingField === 'aadhaar_front'}
            onUpload={() => handleSelectSource('aadhaar_front')}
            onRemove={() => setAadhaarFront(null)}
          />

          {/* Aadhaar Back */}
          <DocumentCard
            title="Aadhaar Back"
            required={true}
            imageUri={resolveImageUrl(aadhaarBack)}
            isUploading={uploadingField === 'aadhaar_back'}
            onUpload={() => handleSelectSource('aadhaar_back')}
            onRemove={() => setAadhaarBack(null)}
          />
        </View>

        {/* Section 2: PAN Card */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>Step 2</Text>
          </View>
          <Text style={styles.sectionHeading}>PAN Card Photos</Text>
        </View>
        <Text style={styles.sectionSub}>Upload front and back photos of your PAN Card for identity and tax compliance verification.</Text>

        <View style={styles.docRow}>
          {/* PAN Front */}
          <DocumentCard
            title="PAN Front"
            required={true}
            imageUri={resolveImageUrl(panFront)}
            isUploading={uploadingField === 'pan_front'}
            onUpload={() => handleSelectSource('pan_front')}
            onRemove={() => setPanFront(null)}
          />

          {/* PAN Back */}
          <DocumentCard
            title="PAN Back"
            required={true}
            imageUri={resolveImageUrl(panBack)}
            isUploading={uploadingField === 'pan_back'}
            onUpload={() => handleSelectSource('pan_back')}
            onRemove={() => setPanBack(null)}
          />
        </View>

        {/* Submission Action */}
        <View style={styles.actionContainer}>
          <Button
            title="Review & Submit KYC"
            onPress={handleReviewAndSubmit}
            style={styles.submitBtn}
          />
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Review KYC Dossier</Text>
                <Text style={styles.modalSubtitle}>Verify all 4 document photos before final submission</Text>
              </View>
              <TouchableOpacity
                onPress={() => setReviewModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
              {/* Applicant Snapshot */}
              <View style={styles.snapshotCard}>
                <Text style={styles.snapshotLabel}>Provider Business:</Text>
                <Text style={styles.snapshotValue}>{profile?.businessName || user?.name || 'Service Partner'}</Text>

                <Text style={[styles.snapshotLabel, { marginTop: spacing.xs }]}>Applicant Contact:</Text>
                <Text style={styles.snapshotValue}>{user?.email} • {user?.phone}</Text>
              </View>

              {/* Document Thumbnails Grid */}
              <View style={styles.reviewGrid}>
                <ReviewThumb label="Aadhaar Front" uri={resolveImageUrl(aadhaarFront)} />
                <ReviewThumb label="Aadhaar Back" uri={resolveImageUrl(aadhaarBack)} />
                <ReviewThumb label="PAN Front" uri={resolveImageUrl(panFront)} />
                <ReviewThumb label="PAN Back" uri={resolveImageUrl(panBack)} />
              </View>

              <Text style={styles.declarationText}>
                By submitting, I confirm that the uploaded identity documents are valid, belong to this registered business/provider, and comply with platform verification policies.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Edit Documents"
                variant="outline"
                onPress={() => setReviewModalVisible(false)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Confirm & Submit"
                loading={submitting}
                disabled={submitting}
                onPress={handleFinalSubmit}
                style={{ flex: 1, backgroundColor: '#7C3AED' }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DocumentCard({ title, required, imageUri, isUploading, onUpload, onRemove }) {
  return (
    <Card style={styles.docCard}>
      <View style={styles.docCardHeader}>
        <Text style={styles.docCardTitle}>{title}</Text>
        <View style={[styles.badge, required ? styles.badgeRequired : styles.badgeOptional]}>
          <Text style={styles.badgeText}>{required ? 'REQUIRED' : 'OPTIONAL'}</Text>
        </View>
      </View>

      <View style={styles.previewContainer}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderBox}>
            <Ionicons name="document-text-outline" size={32} color="#6B7280" />
            <Text style={styles.placeholderText}>No photo uploaded</Text>
          </View>
        )}

        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.uploadOverlayText}>Uploading...</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: '#7C3AED' }]}
          onPress={onUpload}
          activeOpacity={0.8}
          disabled={isUploading}
        >
          <Ionicons name={imageUri ? 'camera-reverse-outline' : 'cloud-upload-outline'} size={15} color="#FFFFFF" />
          <Text style={styles.btnActionText}>{imageUri ? 'Replace' : 'Upload'}</Text>
        </TouchableOpacity>

        {imageUri ? (
          <TouchableOpacity
            style={[styles.btnAction, { backgroundColor: '#374151', marginLeft: spacing.xs }]}
            onPress={onRemove}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

function ReviewThumb({ label, uri }) {
  return (
    <View style={styles.reviewItem}>
      <Text style={styles.reviewItemLabel}>{label}</Text>
      <View style={styles.reviewThumbBox}>
        {uri ? (
          <Image source={{ uri }} style={styles.reviewImage} resizeMode="cover" />
        ) : (
          <View style={styles.missingBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
            <Text style={styles.missingText}>Missing</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  statusVerified: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  statusRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },
  statusDesc: {
    fontSize: 12,
    color: '#D1D5DB',
    lineHeight: 16
  },
  alertBannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  alertTextError: {
    fontSize: 12,
    color: '#F87171',
    flex: 1
  },
  alertBannerSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  alertTextSuccess: {
    fontSize: 12,
    color: '#34D399',
    flex: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2
  },
  sectionBadge: {
    backgroundColor: '#2E1065',
    borderWidth: 1,
    borderColor: '#7C3AED',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  sectionBadgeText: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '700'
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sectionSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: spacing.md
  },
  docRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  docCard: {
    flex: 1,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  docCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeRequired: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1
  },
  badgeOptional: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    borderColor: 'rgba(107, 114, 128, 0.5)',
    borderWidth: 1
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#E5E7EB'
  },
  previewContainer: {
    height: 110,
    borderRadius: 8,
    backgroundColor: '#1F1B2E',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E2845'
  },
  previewImage: {
    width: '100%',
    height: '100%'
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholderText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  uploadOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
    gap: 4
  },
  btnActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  actionContainer: {
    marginTop: spacing.xl,
    paddingTop: spacing.md
  },
  submitBtn: {
    backgroundColor: '#7C3AED'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: spacing.md
  },
  modalContent: {
    backgroundColor: '#161420',
    borderRadius: 18,
    borderColor: '#252136',
    borderWidth: 1,
    padding: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#252136',
    paddingBottom: spacing.sm
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#9CA3AF'
  },
  closeBtn: {
    padding: spacing.xs
  },
  snapshotCard: {
    backgroundColor: '#1F1B2E',
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2E2845',
    marginBottom: spacing.md
  },
  snapshotLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase'
  },
  snapshotValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600'
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  reviewItem: {
    width: '48%'
  },
  reviewItemLabel: {
    fontSize: 11,
    color: '#D1D5DB',
    fontWeight: '600',
    marginBottom: 4
  },
  reviewThumbBox: {
    height: 90,
    borderRadius: 8,
    backgroundColor: '#1F1B2E',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E2845',
    justifyContent: 'center',
    alignItems: 'center'
  },
  reviewImage: {
    width: '100%',
    height: '100%'
  },
  missingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  missingText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '600'
  },
  declarationText: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
    fontStyle: 'italic',
    paddingHorizontal: 2
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#252136',
    paddingTop: spacing.md
  }
});
