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
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/AuthContext';
import { providerApi, providerTagApi } from '../../services/api';
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

  // Optional Service Certification states
  const [certification, setCertification] = useState(profile?.serviceCertification || null);
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [isCertUploading, setIsCertUploading] = useState(false);
  const [certActionLoading, setCertActionLoading] = useState(false);
  const [serviceSelectModalVisible, setServiceSelectModalVisible] = useState(false);

  useEffect(() => {
    providerApi.getProfile()
      .then((res) => {
        if (res?.data) {
          setProfile(res.data);
          if (res.data.aadhaarFrontImage) setAadhaarFront(res.data.aadhaarFrontImage);
          if (res.data.aadhaarBackImage) setAadhaarBack(res.data.aadhaarBackImage);
          if (res.data.panFrontImage) setPanFront(res.data.panFrontImage);
          if (res.data.panBackImage) setPanBack(res.data.panBackImage);
          if (res.data.serviceCertification) {
            setCertification(res.data.serviceCertification);
            if (res.data.serviceCertification.category?._id) {
              setSelectedCategoryId(res.data.serviceCertification.category._id);
            }
            if (res.data.serviceCertification.tag?._id) {
              setSelectedTagId(res.data.serviceCertification.tag._id);
            }
          }
        }
      })
      .catch(() => {});

    // Fetch provider's configured services and approved tags to populate Related Service dropdown
    providerTagApi.getMyServicesAndTags()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setAvailableServices(res.data);
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

  const handlePickCertification = async () => {
    if (!selectedCategoryId || !selectedTagId) {
      Alert.alert('Select Related Service', 'Please select a Related Service & Tag from the dropdown before uploading your certificate.');
      return;
    }

    Alert.alert(
      'Upload Service Certificate',
      'Choose certificate file type:',
      [
        {
          text: 'PDF Document',
          onPress: async () => {
            try {
              const docRes = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                copyToCacheDirectory: true
              });

              if (docRes.canceled || !docRes.assets || docRes.assets.length === 0) return;
              const asset = docRes.assets[0];
              await uploadCertificationAsset(asset, 'application/pdf');
            } catch (err) {
              Alert.alert('Upload Error', err.message || 'Failed to select document');
            }
          }
        },
        {
          text: 'Photo (JPG/PNG)',
          onPress: async () => {
            try {
              const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!libPerm.granted) {
                Alert.alert('Permission Denied', 'Media library permission is required.');
                return;
              }
              const imgRes = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8
              });
              if (imgRes.canceled || !imgRes.assets || imgRes.assets.length === 0) return;
              const asset = imgRes.assets[0];
              const mime = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
              await uploadCertificationAsset(asset, mime);
            } catch (err) {
              Alert.alert('Upload Error', err.message || 'Failed to select photo');
            }
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const uploadCertificationAsset = async (asset, mimeType) => {
    setIsCertUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('categoryId', selectedCategoryId);
      formData.append('tagId', selectedTagId);

      const uri = asset.uri;
      const isPdf = mimeType.includes('pdf') || (asset.name || '').endsWith('.pdf');
      const safeFilename = asset.name || `cert_${Date.now()}.${isPdf ? 'pdf' : 'jpg'}`;

      if (Platform.OS === 'web') {
        if (asset.file instanceof Blob) {
          formData.append('document', asset.file, safeFilename);
        } else {
          const fetchRes = await fetch(uri);
          const blob = await fetchRes.blob();
          const file = new File([blob], safeFilename, { type: mimeType });
          formData.append('document', file, safeFilename);
        }
      } else {
        formData.append('document', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name: safeFilename,
          type: mimeType
        });
      }

      const res = await providerApi.uploadCertification(formData);
      if (res?.success && res.data?.serviceCertification) {
        setCertification(res.data.serviceCertification);
        Alert.alert('Success', 'Professional service certification uploaded successfully! Verification is pending admin review.');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to upload certification';
      Alert.alert('Upload Failed', msg);
    } finally {
      setIsCertUploading(false);
    }
  };

  const handleRemoveCertification = () => {
    Alert.alert(
      'Remove Certification',
      'Are you sure you want to remove your uploaded certification? This will not affect your mandatory KYC verification or registration.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setCertActionLoading(true);
            try {
              const res = await providerApi.removeCertification();
              if (res?.success) {
                setCertification(null);
                setSelectedCategoryId('');
                setSelectedTagId('');
                Alert.alert('Removed', 'Service certification has been removed.');
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to remove certification');
            } finally {
              setCertActionLoading(false);
            }
          }
        }
      ]
    );
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

      <ScrollView showsHorizontalScrollIndicator={false}
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

        {/* Section 3: Optional Professional Service Certification */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <View style={[styles.sectionBadge, { backgroundColor: '#3B82F6' }]}>
            <Text style={styles.sectionBadgeText}>Step 3</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.sectionHeading}>Professional Service Certification</Text>
            <View style={[styles.badge, styles.badgeOptional]}>
              <Text style={styles.badgeText}>OPTIONAL</Text>
            </View>
          </View>
        </View>
        <Text style={styles.sectionSub}>
          Upload a certificate, professional qualification, or training document related to the services you provide. This document is optional and will not block registration or KYC verification.
        </Text>

        <Card style={styles.certCard}>
          {/* Related Service Selector Button */}
          <Text style={styles.certFieldLabel}>Related Service & Tag</Text>
          <TouchableOpacity
            style={styles.certSelectorBtn}
            onPress={() => setServiceSelectModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="pricetag-outline" size={18} color="#A78BFA" />
            <Text style={styles.certSelectorText} numberOfLines={1}>
              {(() => {
                if (selectedCategoryId && selectedTagId) {
                  for (const cat of availableServices) {
                    if (cat.category?._id === selectedCategoryId) {
                      const tag = (cat.tags || []).find((t) => t.tag?._id === selectedTagId);
                      if (tag) return `${cat.category?.name || 'Category'} → ${tag.tag?.name || 'Tag'}`;
                    }
                  }
                  if (certification?.category?.name && certification?.tag?.name) {
                    return `${certification.category.name} → ${certification.tag.name}`;
                  }
                }
                return 'Select Category & Service Tag...';
              })()}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Current Certification Status Banner */}
          <View style={styles.certStatusRow}>
            <Text style={styles.certStatusLabel}>Verification Status:</Text>
            <View
              style={[
                styles.certStatusBadge,
                !certification?.documentUrl
                  ? { backgroundColor: '#374151' }
                  : certification.verificationStatus === 'VERIFIED'
                  ? { backgroundColor: '#065F46' }
                  : certification.verificationStatus === 'REJECTED'
                  ? { backgroundColor: '#991B1B' }
                  : { backgroundColor: '#92400E' }
              ]}
            >
              <Text style={styles.certStatusBadgeText}>
                {!certification?.documentUrl
                  ? 'Not Uploaded'
                  : certification.verificationStatus === 'VERIFIED'
                  ? 'Verified'
                  : certification.verificationStatus === 'REJECTED'
                  ? 'Rejected'
                  : 'Pending Verification'}
              </Text>
            </View>
          </View>

          {/* Rejection Note Display if rejected */}
          {certification?.documentUrl && certification.verificationStatus === 'REJECTED' && certification.rejectionReason && (
            <View style={styles.certRejectionBox}>
              <Ionicons name="alert-circle" size={16} color="#F87171" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.certRejectionTitle}>Admin Rejection Reason:</Text>
                <Text style={styles.certRejectionText}>{certification.rejectionReason}</Text>
                <Text style={styles.certRejectionSub}>You can replace this certificate with an updated document below.</Text>
              </View>
            </View>
          )}

          {/* Document Preview & Details */}
          {certification?.documentUrl ? (
            <View style={styles.certPreviewBox}>
              <View style={styles.certFileIconBox}>
                <Ionicons
                  name={
                    (certification.originalFileName || '').toLowerCase().endsWith('.pdf') ||
                    (certification.documentUrl || '').toLowerCase().includes('.pdf')
                      ? 'document-text'
                      : 'image'
                  }
                  size={28}
                  color="#A78BFA"
                />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.certFileName} numberOfLines={1}>
                  {certification.originalFileName || 'Service Certificate'}
                </Text>
                <Text style={styles.certFileMeta}>
                  {certification.uploadedAt ? `Uploaded ${new Date(certification.uploadedAt).toLocaleDateString()}` : 'Uploaded'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.certPlaceholderBox}>
              <Ionicons name="ribbon-outline" size={32} color="#6B7280" />
              <Text style={styles.certPlaceholderText}>No certificate uploaded (Optional)</Text>
              <Text style={styles.certPlaceholderSub}>Supports PDF, JPG, PNG up to 5 MB</Text>
            </View>
          )}

          {/* Upload Progress State */}
          {isCertUploading && (
            <View style={styles.certUploadingBar}>
              <ActivityIndicator size="small" color="#A78BFA" />
              <Text style={styles.certUploadingText}>Uploading certificate to secure storage...</Text>
            </View>
          )}

          {/* Certification Actions Row */}
          <View style={styles.certActionsRow}>
            <TouchableOpacity
              style={[
                styles.certActionBtn,
                { backgroundColor: '#7C3AED', flex: 1 },
                (!selectedCategoryId || !selectedTagId) && { opacity: 0.6 }
              ]}
              onPress={handlePickCertification}
              disabled={isCertUploading || certActionLoading}
              activeOpacity={0.8}
            >
              <Ionicons
                name={certification?.documentUrl ? 'sync-outline' : 'cloud-upload-outline'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.certActionBtnText}>
                {certification?.documentUrl ? 'Replace Certificate' : 'Upload Certificate'}
              </Text>
            </TouchableOpacity>

            {certification?.documentUrl ? (
              <TouchableOpacity
                style={[styles.certActionBtn, { backgroundColor: '#374151', marginLeft: spacing.sm }]}
                onPress={handleRemoveCertification}
                disabled={isCertUploading || certActionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#F87171" />
                <Text style={[styles.certActionBtnText, { color: '#F87171' }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

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

            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
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

      {/* Service & Tag Picker Modal */}
      <Modal
        visible={serviceSelectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setServiceSelectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Related Service</Text>
                <Text style={styles.modalSubtitle}>Link your certificate to your active service tag</Text>
              </View>
              <TouchableOpacity
                onPress={() => setServiceSelectModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginVertical: spacing.md }}>
              {availableServices.length === 0 ? (
                <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={36} color="#9CA3AF" />
                  <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: spacing.sm, textAlign: 'center' }}>
                    No services found. Add your services in "My Services" first to link certifications.
                  </Text>
                </View>
              ) : (
                availableServices.map((catGroup) => (
                  <View key={catGroup.category?._id} style={{ marginBottom: spacing.md }}>
                    <Text style={styles.pickerCategoryTitle}>
                      {catGroup.category?.name || 'Category'}
                    </Text>
                    <View style={{ gap: spacing.xs, marginTop: 4 }}>
                      {(catGroup.tags || []).map((tItem) => {
                        const isSelected =
                          selectedCategoryId === catGroup.category?._id &&
                          selectedTagId === tItem.tag?._id;
                        return (
                          <TouchableOpacity
                            key={tItem.tag?._id}
                            style={[
                              styles.pickerTagItem,
                              isSelected && styles.pickerTagItemSelected
                            ]}
                            onPress={() => {
                              setSelectedCategoryId(catGroup.category._id);
                              setSelectedTagId(tItem.tag._id);
                              setServiceSelectModalVisible(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={18}
                              color={isSelected ? '#A78BFA' : '#6B7280'}
                            />
                            <View style={{ flex: 1, marginLeft: spacing.sm }}>
                              <Text style={[styles.pickerTagName, isSelected && { color: '#FFFFFF' }]}>
                                {tItem.tag?.name}
                              </Text>
                              {tItem.tag?.subcategory?.name ? (
                                <Text style={styles.pickerTagSub}>{tItem.tag.subcategory.name}</Text>
                              ) : null}
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color="#A78BFA" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
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
  },
  // Service Certification Card Styles
  certCard: {
    backgroundColor: '#1E1B2E',
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2D2845',
    marginTop: spacing.xs
  },
  certFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 6
  },
  certSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: '#373052',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.md
  },
  certSelectorText: {
    flex: 1,
    fontSize: 13,
    color: '#F3F4F6',
    fontWeight: '500',
    marginHorizontal: spacing.xs
  },
  certStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm
  },
  certStatusLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  certStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  certStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  certRejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2D151B',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  certRejectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171'
  },
  certRejectionText: {
    fontSize: 12,
    color: '#FECACA',
    marginTop: 2
  },
  certRejectionSub: {
    fontSize: 10,
    color: '#FCA5A5',
    marginTop: 4,
    fontStyle: 'italic'
  },
  certPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: '#2E2848',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md
  },
  certFileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#272042',
    alignItems: 'center',
    justifyContent: 'center'
  },
  certFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  certFileMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  certPlaceholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161324',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#373052',
    borderRadius: 10,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md
  },
  certPlaceholderText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 6
  },
  certPlaceholderSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2
  },
  certUploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#251F3D',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md
  },
  certUploadingText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '500'
  },
  certActionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  certActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    gap: 6
  },
  certActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  pickerCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  pickerTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1B2E',
    borderWidth: 1,
    borderColor: '#2E2845',
    borderRadius: 8,
    padding: spacing.sm
  },
  pickerTagItemSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#272042'
  },
  pickerTagName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D1D5DB'
  },
  pickerTagSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  }
});
