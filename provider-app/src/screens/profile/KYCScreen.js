import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Modal,
  Linking,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { providerApi, providerTagApi } from '../../services/api';
import { Card, Button, Header } from '../../components/common';
import API_CONFIG from '../../config/env';
import { spacing, typography, borderRadius } from '../../theme';

const KYC_IMAGE_FIELDS = {
  aadhaar_front: 'aadhaarFrontImage',
  aadhaar_back: 'aadhaarBackImage',
  pan_front: 'panFrontImage',
  pan_back: 'panBackImage'
};

export default function KYCScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user, profile: authProfile, checkAuthSession, refreshProviderProfile } = useAuth();
  const [profile, setProfile] = useState(authProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

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
  const [serviceSelectModalVisible, setServiceSelectModalVisible] = useState(false);
  const [availableServices, setAvailableServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [isCertUploading, setIsCertUploading] = useState(false);
  const [certActionLoading, setCertActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileReady(false);
    setErrorMsg(null);
    try {
      const currentProfile = await refreshProviderProfile();
      setProfile(currentProfile);
      setAadhaarFront(currentProfile.aadhaarFrontImage || null);
      setAadhaarBack(currentProfile.aadhaarBackImage || null);
      setPanFront(currentProfile.panFrontImage || null);
      setPanBack(currentProfile.panBackImage || null);
      setCertification(currentProfile.serviceCertification || null);
      setSelectedCategoryId(currentProfile.serviceCertification?.category?._id || '');
      setSelectedTagId(currentProfile.serviceCertification?.tag?._id || '');
      setProfileReady(true);
    } catch (err) {
      setErrorMsg(err.userMessage || err.message || 'Unable to load your latest KYC status.');
    } finally {
      setProfileLoading(false);
    }
  }, [refreshProviderProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfile();
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile]);

  const normalizeConfiguredServices = (responseData) => {
    if (!responseData) return [];

    // 1. Direct configuredServices array from backend
    if (Array.isArray(responseData.configuredServices) && responseData.configuredServices.length > 0) {
      return responseData.configuredServices;
    }

    // 2. Direct array format
    if (Array.isArray(responseData)) {
      return responseData;
    }

    // 3. Extract active configured tags from catalog with selection indicators
    if (Array.isArray(responseData.catalog)) {
      const groups = [];
      responseData.catalog.forEach((catItem) => {
        const cat = catItem.category;
        if (!cat) return;
        const catTags = [];
        (catItem.subcategories || []).forEach((sub) => {
          (sub.tags || []).forEach((t) => {
            const isSel = Boolean(t.isSelected || t.selectedConfig);
            const isActive = t.selectedConfig ? t.selectedConfig.isActive !== false : true;
            const notRejected = t.selectedConfig?.approvalStatus !== 'rejected';
            if (isSel && isActive && notRejected) {
              catTags.push({
                tag: {
                  _id: t._id,
                  name: t.name,
                  slug: t.slug,
                  subcategory: t.subcategory || (sub.name ? { name: sub.name } : null)
                },
                isActive: true,
                approvalStatus: t.selectedConfig?.approvalStatus || 'approved',
                basePrice: t.selectedConfig?.basePrice || 0
              });
            }
          });
        });
        if (catTags.length > 0) {
          groups.push({
            category: cat,
            tags: catTags
          });
        }
      });
      if (groups.length > 0) return groups;
    }

    return [];
  };

  const fetchServices = useCallback(async () => {
    setServicesLoading(true);
    setServicesError(null);
    try {
      const res = await providerTagApi.getMyServicesAndTags();
      if (res?.success && res.data) {
        const parsed = normalizeConfiguredServices(res.data);
        setAvailableServices(parsed);
      } else {
        setServicesError('Failed to retrieve services.');
      }
    } catch (err) {
      setServicesError(err.userMessage || err.message || 'Failed to connect to services catalogue.');
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const resolveImageUrl = (pathOrUrl) => {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const base = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '');
    return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  };

  const handlePickDocument = async (field, source = 'library') => {
    if (!canEditKycDocument(field)) return;
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
        const uploadedAt = res.data.uploadedAt || new Date().toISOString();
        const imageField = KYC_IMAGE_FIELDS[field];
        if (field === 'aadhaar_front') setAadhaarFront(uploadedUrl);
        else if (field === 'aadhaar_back') setAadhaarBack(uploadedUrl);
        else if (field === 'pan_front') setPanFront(uploadedUrl);
        else if (field === 'pan_back') setPanBack(uploadedUrl);
        setProfile((currentProfile) => {
          if (!currentProfile) return currentProfile;
          let foundDocument = false;
          const documents = (currentProfile.documents || []).map((document) => {
            if (document.type.toLowerCase() !== field) return document;
            foundDocument = true;
            return { ...document, documentUrl: uploadedUrl, uploadedAt };
          });
          if (!foundDocument && kycStatus !== 'REJECTED') {
            documents.push({
              type: field,
              documentUrl: uploadedUrl,
              uploadedAt,
              verificationStatus: 'pending'
            });
          }
          return {
            ...currentProfile,
            [imageField]: uploadedUrl,
            documents
          };
        });

        if (typeof refreshProviderProfile === 'function') {
          refreshProviderProfile().catch(() => {});
        }

        setSuccessMsg(`${formatFieldLabel(field)} uploaded successfully!`);
      } else {
        Alert.alert('Upload Failed', res?.message || 'Could not upload document.');
      }
    } catch (err) {
      console.error('KYC file upload error:', err);
      if (err.response?.status === 409) await fetchProfile();
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

  const handleRemoveDocument = (field) => {
    if (!canDeleteKycDocument(field)) return;
    Alert.alert(
      'Delete Document',
      `Remove ${formatFieldLabel(field)} from your KYC draft?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUploadingField(field);
            try {
              await providerApi.deleteKYCDocument(field);
              if (field === 'aadhaar_front') setAadhaarFront(null);
              else if (field === 'aadhaar_back') setAadhaarBack(null);
              else if (field === 'pan_front') setPanFront(null);
              else if (field === 'pan_back') setPanBack(null);
            } catch (err) {
              if (err.response?.status === 409) await fetchProfile();
              Alert.alert('Delete Failed', err.userMessage || err.message || 'Could not remove document.');
            } finally {
              setUploadingField(null);
            }
          }
        }
      ]
    );
  };

  const pickCertificateDocument = async () => {
    try {
      if (__DEV__) console.log('[Cert Picker] Opening DocumentPicker (PDF, JPG, PNG)...');
      const docRes = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true
      });

      if (docRes.canceled || !docRes.assets || docRes.assets.length === 0) {
        if (__DEV__) console.log('[Cert Picker] Document selection cancelled by user.');
        return;
      }

      const asset = docRes.assets[0];
      if (__DEV__) {
        console.log('[Cert Picker] Asset received:', {
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
          hasFile: Boolean(asset.file)
        });
      }
      await validateAndUploadCertificate(asset, asset.mimeType);
    } catch (err) {
      console.error('[Cert Picker Error]:', err);
      const errMsg = err.message || 'Failed to select certificate document';
      setErrorMsg(errMsg);
      if (Platform.OS !== 'web') {
        Alert.alert('Picker Error', errMsg);
      }
    }
  };

  const pickCertificateImage = async (source = 'library') => {
    try {
      let imgRes;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Camera permission is required to photograph your certificate.');
          return;
        }
        imgRes = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Media library permission is required to select your certificate.');
          return;
        }
        imgRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8
        });
      }

      if (imgRes.canceled || !imgRes.assets || imgRes.assets.length === 0) {
        if (__DEV__) console.log('[Cert Image Picker] Image selection cancelled by user.');
        return;
      }

      const asset = imgRes.assets[0];
      const mime = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
      await validateAndUploadCertificate(asset, mime);
    } catch (err) {
      console.error('[Cert Image Picker Error]:', err);
      Alert.alert('Picker Error', err.message || 'Failed to select certificate image');
    }
  };

  const handlePickCertification = async () => {
    if (!profileReady) return;
    if (!selectedCategoryId || !selectedTagId) {
      const msg = 'Please select a Related Service & Tag from the dropdown before uploading your certificate.';
      setErrorMsg(msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Select Related Service', msg);
      }
      return;
    }

    if (Platform.OS === 'web') {
      // On Web: Launch native file selection dialog directly (supports PDF, JPG, PNG seamlessly)
      await pickCertificateDocument();
    } else {
      // On Android / Native: Present choices for document or photo gallery
      Alert.alert(
        'Upload Service Certificate',
        'Choose certificate file source:',
        [
          {
            text: 'PDF Document or File',
            onPress: () => pickCertificateDocument()
          },
          {
            text: 'Photo Gallery',
            onPress: () => pickCertificateImage('library')
          },
          {
            text: 'Take Photo',
            onPress: () => pickCertificateImage('camera')
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const validateAndUploadCertificate = async (asset, initialMimeType) => {
    if (isCertUploading) {
      if (__DEV__) console.log('[Cert Upload] Upload already in progress, ignoring duplicate action.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Missing file check
    if (!asset || (!asset.uri && !asset.file)) {
      const err = 'Selected file is invalid or missing.';
      setErrorMsg(err);
      if (Platform.OS === 'web') window.alert(err);
      else Alert.alert('Invalid File', err);
      return;
    }

    // 2. Resolve filename and extension
    const filename = asset.name || (asset.file ? asset.file.name : '') || `cert_${Date.now()}`;
    const ext = (filename.toLowerCase().split('.').pop() || '').trim();

    // 3. Resolve safe MIME type
    let resolvedMime = (initialMimeType || asset.mimeType || (asset.file ? asset.file.type : '') || '').toLowerCase();
    if (!resolvedMime || resolvedMime === '*/*' || resolvedMime === 'application/octet-stream') {
      if (ext === 'pdf') resolvedMime = 'application/pdf';
      else if (ext === 'png') resolvedMime = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') resolvedMime = 'image/jpeg';
      else resolvedMime = 'application/octet-stream';
    }

    // 4. File type check (PDF, JPG, JPEG, PNG)
    const isPdf = resolvedMime === 'application/pdf' || ext === 'pdf';
    const isImage = ['image/jpeg', 'image/png', 'image/jpg'].includes(resolvedMime) ||
                    ['jpg', 'jpeg', 'png'].includes(ext);

    if (!isPdf && !isImage) {
      const err = 'Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.';
      setErrorMsg(err);
      if (Platform.OS === 'web') window.alert(err);
      else Alert.alert('Unsupported File Type', err);
      return;
    }

    // Normalize standard MIME
    const finalMime = isPdf ? 'application/pdf' : (ext === 'png' || resolvedMime === 'image/png') ? 'image/png' : 'image/jpeg';

    // 5. File size check (Max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    const fileSize = asset.size || (asset.file ? asset.file.size : 0);
    if (fileSize > MAX_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      const err = `File size (${sizeMB} MB) exceeds maximum allowed limit of 5 MB. Please select a smaller file.`;
      setErrorMsg(err);
      if (Platform.OS === 'web') window.alert(err);
      else Alert.alert('File Too Large', err);
      return;
    }

    const safeFilename = filename.includes('.') ? filename : `${filename}.${isPdf ? 'pdf' : (finalMime === 'image/png' ? 'png' : 'jpg')}`;

    setIsCertUploading(true);

    if (__DEV__) {
      console.log('[Cert Upload] Preparing FormData payload:', {
        categoryId: selectedCategoryId,
        tagId: selectedTagId,
        filename: safeFilename,
        finalMime,
        fileSize,
        platform: Platform.OS
      });
    }

    try {
      const formData = new FormData();
      formData.append('categoryId', selectedCategoryId);
      formData.append('tagId', selectedTagId);

      if (Platform.OS === 'web') {
        if (asset.file instanceof Blob) {
          formData.append('document', asset.file, safeFilename);
        } else {
          const fetchRes = await fetch(asset.uri);
          const blob = await fetchRes.blob();
          const file = new File([blob], safeFilename, { type: finalMime });
          formData.append('document', file, safeFilename);
        }
      } else {
        formData.append('document', {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
          name: safeFilename,
          type: finalMime
        });
      }

      const res = await providerApi.uploadCertification(formData);

      if (__DEV__) {
        console.log('[Cert Upload Response]:', {
          success: res?.success,
          message: res?.message,
          hasData: Boolean(res?.data)
        });
      }

      if (res?.success) {
        const newCert = res.data?.serviceCertification || res.data;
        setCertification(newCert);

        // Update local provider profile state
        setProfile((prev) => prev ? { ...prev, serviceCertification: newCert } : prev);

        // Refresh authoritative profile from backend
        if (typeof refreshProviderProfile === 'function') {
          refreshProviderProfile().catch((e) => {
            if (__DEV__) console.log('[Refresh Profile Note]:', e.message);
          });
        }

        const successMessage = 'Professional service certification uploaded successfully! Verification is pending admin review.';
        setSuccessMsg(successMessage);
        if (Platform.OS !== 'web') {
          Alert.alert('Upload Successful', successMessage);
        }
      } else {
        const errMsg = res?.message || 'Certificate upload failed. Please try again.';
        setErrorMsg(errMsg);
        if (Platform.OS === 'web') window.alert(errMsg);
        else Alert.alert('Upload Failed', errMsg);
      }
    } catch (err) {
      console.error('[Cert Upload Error]:', err);
      const errMsg = err.response?.data?.error?.message || err.userMessage || err.message || 'Failed to upload certificate. Ensure file is under 5MB.';
      setErrorMsg(errMsg);
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Upload Failed', errMsg);
    } finally {
      setIsCertUploading(false);
    }
  };

  const doRemoveCertification = async () => {
    setCertActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await providerApi.removeCertification();
      if (res?.success) {
        setCertification(null);
        setSelectedCategoryId('');
        setSelectedTagId('');
        setProfile((prev) => prev ? { ...prev, serviceCertification: null } : prev);
        if (typeof refreshProviderProfile === 'function') {
          refreshProviderProfile().catch(() => {});
        }
        const msg = 'Service certification has been removed.';
        setSuccessMsg(msg);
        if (Platform.OS !== 'web') {
          Alert.alert('Removed', msg);
        }
      } else {
        const errMsg = res?.message || 'Failed to remove certification';
        setErrorMsg(errMsg);
        if (Platform.OS === 'web') window.alert(errMsg);
        else Alert.alert('Remove Failed', errMsg);
      }
    } catch (err) {
      console.error('[Cert Remove Error]:', err);
      const errMsg = err.response?.data?.error?.message || err.userMessage || err.message || 'Failed to remove certification';
      setErrorMsg(errMsg);
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Remove Failed', errMsg);
    } finally {
      setCertActionLoading(false);
    }
  };

  const handleRemoveCertification = () => {
    if (!profileReady) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to remove your uploaded certification? This will not affect your mandatory KYC verification or registration.')) {
        doRemoveCertification();
      }
      return;
    }

    Alert.alert(
      'Remove Certification',
      'Are you sure you want to remove your uploaded certification? This will not affect your mandatory KYC verification or registration.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: doRemoveCertification
        }
      ]
    );
  };

  const handlePreviewCertificate = () => {
    if (!certification?.documentUrl) return;
    try {
      if (Platform.OS === 'web') {
        window.open(certification.documentUrl, '_blank');
      } else {
        Linking.openURL(certification.documentUrl).catch(() => {
          Alert.alert('Cannot Open Document', 'Failed to open document preview.');
        });
      }
    } catch {
      Alert.alert('Cannot Open Document', 'Failed to open document preview.');
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
    if (!profileReady || isKycLocked) return;
    if (!validateKYCPackage()) return;
    if (!canSubmit) {
      Alert.alert(
        'Documents Need Correction',
        'Replace each rejected document before resubmitting for verification.'
      );
      return;
    }
    setReviewModalVisible(true);
  };

  const handleFinalSubmit = async () => {
    if (!profileReady || isKycLocked || !canSubmit) return;
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
        setSuccessMsg('Documents submitted successfully. Waiting for admin approval.');
        await checkAuthSession();
        setReviewModalVisible(false);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setReviewModalVisible(false);
        await fetchProfile();
      }
      setErrorMsg(err.userMessage || err.message || 'Submission failed. Please check your documents.');
    } finally {
      setSubmitting(false);
    }
  };

  const storedKycStatus = String(profile?.kycStatus || 'NOT_SUBMITTED').toUpperCase();
  const isApproved =
    storedKycStatus === 'APPROVED' ||
    storedKycStatus === 'VERIFIED';

  const kycStatus = isApproved
    ? 'APPROVED'
    : storedKycStatus === 'REJECTED'
    ? 'REJECTED'
    : storedKycStatus === 'UNDER_REVIEW' || storedKycStatus === 'PENDING'
    ? (profile?.kycSubmittedAt || (profile?.aadhaarFrontImage && profile?.aadhaarBackImage && profile?.panFrontImage && profile?.panBackImage))
      ? 'PENDING'
      : 'NOT_SUBMITTED'
    : storedKycStatus === 'DRAFT'
    ? 'NOT_SUBMITTED'
    : storedKycStatus;
  const isKycLocked = kycStatus === 'PENDING' || kycStatus === 'APPROVED';
  const getKycDocument = (field) => (profile?.documents || []).find(
    (document) => document.type.toLowerCase() === field
  );
  const canEditKycDocument = (field) =>
    profileReady &&
    (
      kycStatus === 'NOT_SUBMITTED' ||
      (kycStatus === 'REJECTED' && getKycDocument(field)?.verificationStatus === 'rejected')
    );
  const canDeleteKycDocument = (field) =>
    profileReady && kycStatus === 'NOT_SUBMITTED';
  const rejectedDocumentTypes = kycStatus === 'REJECTED'
    ? (profile?.documents || [])
      .filter((document) =>
        Object.prototype.hasOwnProperty.call(KYC_IMAGE_FIELDS, document.type.toLowerCase()) &&
        document.verificationStatus === 'rejected'
      )
      .map((document) => document.type.toLowerCase())
    : [];
  const allRejectedDocumentsCorrected = rejectedDocumentTypes.length > 0 &&
    rejectedDocumentTypes.every((field) => {
      const document = getKycDocument(field);
      return document?.uploadedAt &&
        profile?.kycReviewedAt &&
        new Date(document.uploadedAt).getTime() > new Date(profile.kycReviewedAt).getTime();
    });
  const requiredDocumentsComplete = Boolean(aadhaarFront && aadhaarBack && panFront && panBack);
  const canSubmit = requiredDocumentsComplete &&
    (kycStatus !== 'REJECTED' || allRejectedDocumentsCorrected);
  const getKycDocumentRejectionNote = (field) => {
    const document = getKycDocument(field);
    return document?.verificationStatus === 'rejected' ? document.reviewNote : '';
  };

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} tintColor="#7C3AED" />
        }
      >
        {profileLoading ? (
          <View style={[styles.statusCard, styles.statusPending]}>
            <ActivityIndicator size="small" color="#F59E0B" />
            <Text style={styles.statusDesc}>Checking your latest KYC status...</Text>
          </View>
        ) : null}

        {/* Status Banner */}
        {profileReady ? (
        <View style={[
          styles.statusCard,
          kycStatus === 'APPROVED' ? styles.statusVerified :
          kycStatus === 'REJECTED' ? styles.statusRejected :
          styles.statusPending
        ]}>
          <Ionicons
            name={
              kycStatus === 'APPROVED' ? 'shield-checkmark' :
              kycStatus === 'REJECTED' ? 'close-circle' :
              'time-outline'
            }
            size={24}
            color={
              kycStatus === 'APPROVED' ? '#10B981' :
              kycStatus === 'REJECTED' ? '#EF4444' :
              '#F59E0B'
            }
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.statusTitle,
              {
                color: kycStatus === 'APPROVED' ? '#34D399' :
                       kycStatus === 'REJECTED' ? '#F87171' :
                       '#FBBF24'
              }
            ]}>
              {kycStatus === 'APPROVED' ? 'Verified Successfully' :
               kycStatus === 'REJECTED' ? 'KYC Verification Rejected' :
               kycStatus === 'PENDING' ? 'Verification Under Review' :
               'KYC Documents Required'}
            </Text>
            {kycStatus === 'APPROVED' ? (
              <View style={styles.verifiedBadgeRow}>
                <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                <Text style={styles.verifiedBadge}>Verified Successfully</Text>
              </View>
            ) : null}
            <Text style={styles.statusDesc}>
              {kycStatus === 'APPROVED'
                ? `Your identity documents (Aadhaar & PAN) have been verified and approved.${profile?.kycReviewedAt ? ` Approved on ${new Date(profile.kycReviewedAt).toLocaleDateString()}.` : ''}`
                : kycStatus === 'REJECTED'
                ? (profile?.kycRejectionReason || profile?.rejectionReason || 'Please upload clear and valid replacement photos.')
                : kycStatus === 'PENDING'
                ? 'Documents submitted successfully. Waiting for admin approval.'
                : 'Upload clear, readable photos of both sides of your Aadhaar Card and PAN Card.'}
            </Text>
          </View>
        </View>
        ) : null}

        {errorMsg ? (
          <View style={styles.alertBannerError}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertTextError}>{errorMsg}</Text>
          </View>
        ) : null}
        {!profileLoading && !profileReady ? (
          <TouchableOpacity style={styles.retryProfileButton} onPress={fetchProfile} activeOpacity={0.8}>
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryProfileText}>Retry loading KYC status</Text>
          </TouchableOpacity>
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
            onRemove={() => handleRemoveDocument('aadhaar_front')}
            editable={canEditKycDocument('aadhaar_front')}
            canDelete={canDeleteKycDocument('aadhaar_front')}
            isLocked={profileReady && !canEditKycDocument('aadhaar_front')}
            isApproved={isApproved}
            reviewNote={getKycDocumentRejectionNote('aadhaar_front')}
          />

          {/* Aadhaar Back */}
          <DocumentCard
            title="Aadhaar Back"
            required={true}
            imageUri={resolveImageUrl(aadhaarBack)}
            isUploading={uploadingField === 'aadhaar_back'}
            onUpload={() => handleSelectSource('aadhaar_back')}
            onRemove={() => handleRemoveDocument('aadhaar_back')}
            editable={canEditKycDocument('aadhaar_back')}
            canDelete={canDeleteKycDocument('aadhaar_back')}
            isLocked={profileReady && !canEditKycDocument('aadhaar_back')}
            isApproved={isApproved}
            reviewNote={getKycDocumentRejectionNote('aadhaar_back')}
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
            onRemove={() => handleRemoveDocument('pan_front')}
            editable={canEditKycDocument('pan_front')}
            canDelete={canDeleteKycDocument('pan_front')}
            isLocked={profileReady && !canEditKycDocument('pan_front')}
            isApproved={isApproved}
            reviewNote={getKycDocumentRejectionNote('pan_front')}
          />

          {/* PAN Back */}
          <DocumentCard
            title="PAN Back"
            required={true}
            imageUri={resolveImageUrl(panBack)}
            isUploading={uploadingField === 'pan_back'}
            onUpload={() => handleSelectSource('pan_back')}
            onRemove={() => handleRemoveDocument('pan_back')}
            editable={canEditKycDocument('pan_back')}
            canDelete={canDeleteKycDocument('pan_back')}
            isLocked={profileReady && !canEditKycDocument('pan_back')}
            isApproved={isApproved}
            reviewNote={getKycDocumentRejectionNote('pan_back')}
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
            disabled={!profileReady || (kycStatus !== 'NOT_SUBMITTED' && certification?.verificationStatus !== 'REJECTED' && Boolean(certification?.documentUrl))}
            activeOpacity={0.8}
          >
            <Ionicons name="pricetag-outline" size={18} color="#A78BFA" />
            <Text style={styles.certSelectorText} numberOfLines={1}>
              {(() => {
                if (selectedCategoryId && selectedTagId) {
                  for (const cat of availableServices) {
                    if (String(cat.category?._id) === String(selectedCategoryId)) {
                      const tagItem = (cat.tags || []).find(
                        (t) => String(t.tag?._id || t.tag) === String(selectedTagId)
                      );
                      if (tagItem) {
                        return `${cat.category?.name || 'Category'} → ${tagItem.tag?.name || 'Tag'}`;
                      }
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
            <TouchableOpacity
              style={styles.certPreviewBox}
              activeOpacity={0.8}
              onPress={handlePreviewCertificate}
            >
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
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
                <Ionicons name="open-outline" size={16} color="#A78BFA" />
              </View>
            </TouchableOpacity>
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
          {profileReady && (kycStatus === 'NOT_SUBMITTED' || certification?.verificationStatus === 'REJECTED' || !certification?.documentUrl) ? (
            <View style={styles.certActionsRow}>
              <TouchableOpacity
                style={[
                  styles.certActionBtn,
                  { backgroundColor: '#7C3AED', flex: 1 },
                  (!selectedCategoryId || !selectedTagId || isCertUploading) && { opacity: 0.6 }
                ]}
                onPress={handlePickCertification}
                disabled={isCertUploading || certActionLoading || !selectedCategoryId || !selectedTagId}
                activeOpacity={0.8}
              >
                {isCertUploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={certification?.documentUrl ? 'sync-outline' : 'cloud-upload-outline'}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.certActionBtnText}>
                      {certification?.documentUrl ? 'Replace Certificate' : 'Upload Certificate'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {certification?.documentUrl ? (
                <TouchableOpacity
                  style={[styles.certActionBtn, { backgroundColor: '#374151', marginLeft: spacing.sm }]}
                  onPress={handleRemoveCertification}
                  disabled={isCertUploading || certActionLoading}
                  activeOpacity={0.8}
                >
                  {certActionLoading ? (
                    <ActivityIndicator size="small" color="#F87171" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#F87171" />
                      <Text style={[styles.certActionBtnText, { color: '#F87171' }]}>Remove</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* Submission Action */}
        {profileReady && !isKycLocked ? (
          <View style={styles.actionContainer}>
            <Button
              title={kycStatus === 'REJECTED' ? 'Resubmit for Verification' : 'Submit for Verification'}
              onPress={handleReviewAndSubmit}
              disabled={!canSubmit}
              style={styles.submitBtn}
            />
          </View>
        ) : null}
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
              {servicesLoading ? (
                <View style={styles.pickerStateBox}>
                  <ActivityIndicator size="small" color="#A78BFA" />
                  <Text style={styles.pickerStateText}>Loading active services & tags...</Text>
                </View>
              ) : servicesError ? (
                <View style={styles.pickerStateBox}>
                  <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
                  <Text style={styles.pickerErrorTitle}>Failed to Load Services</Text>
                  <Text style={styles.pickerStateSub}>{servicesError}</Text>
                  <TouchableOpacity
                    style={styles.pickerRetryBtn}
                    onPress={fetchServices}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={14} color="#FFFFFF" />
                    <Text style={styles.pickerRetryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : availableServices.length === 0 ? (
                <View style={styles.pickerStateBox}>
                  <Ionicons name="construct-outline" size={40} color="#9CA3AF" />
                  <Text style={styles.pickerEmptyTitle}>No Active Services Configured</Text>
                  <Text style={styles.pickerStateSub}>
                    You have not configured any active service tags yet. Add your services in "My Services" first to link professional certifications.
                  </Text>
                  <TouchableOpacity
                    style={styles.pickerNavigateBtn}
                    onPress={() => {
                      setServiceSelectModalVisible(false);
                      navigation.navigate('MainTabs', { screen: 'ServicesTab' });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.pickerNavigateBtnText}>Configure My Services</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                availableServices.map((catGroup) => (
                  <View key={catGroup.category?._id} style={{ marginBottom: spacing.md }}>
                    <View style={styles.pickerCategoryHeader}>
                      <Ionicons name="folder-open-outline" size={15} color="#A78BFA" />
                      <Text style={styles.pickerCategoryTitle}>
                        {catGroup.category?.name || 'Category'}
                      </Text>
                      <View style={styles.pickerCatCountBadge}>
                        <Text style={styles.pickerCatCountText}>
                          {(catGroup.tags || []).length}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: spacing.xs, marginTop: 4 }}>
                      {(catGroup.tags || []).map((tItem) => {
                        const tagObj = tItem.tag || {};
                        const isSelected =
                          selectedCategoryId === catGroup.category?._id &&
                          selectedTagId === tagObj._id;
                        return (
                          <TouchableOpacity
                            key={tagObj._id}
                            style={[
                              styles.pickerTagItem,
                              isSelected && styles.pickerTagItemSelected
                            ]}
                            onPress={() => {
                              setSelectedCategoryId(catGroup.category._id);
                              setSelectedTagId(tagObj._id);
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
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.pickerTagName, isSelected && { color: '#FFFFFF' }]}>
                                  {tagObj.name}
                                </Text>
                                <View style={styles.activeTagBadge}>
                                  <Text style={styles.activeTagBadgeText}>ACTIVE</Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                {tagObj.subcategory?.name ? (
                                  <Text style={styles.pickerTagSub}>{tagObj.subcategory.name}</Text>
                                ) : null}
                                {tagObj._id ? (
                                  <Text style={styles.pickerTagIdText}>ID: #{String(tagObj._id).slice(-4)}</Text>
                                ) : null}
                              </View>
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

function DocumentCard({
  title,
  required,
  imageUri,
  isUploading,
  onUpload,
  onRemove,
  editable,
  canDelete,
  isLocked,
  isApproved,
  reviewNote
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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
      {reviewNote ? (
        <Text style={styles.documentReviewNote}>Correction needed: {reviewNote}</Text>
      ) : null}

      {editable ? <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={[styles.btnAction, { backgroundColor: '#7C3AED' }]}
          onPress={onUpload}
          activeOpacity={0.8}
          disabled={isUploading}
        >
          <Ionicons name={imageUri ? 'camera-reverse-outline' : 'cloud-upload-outline'} size={15} color="#FFFFFF" />
          <Text style={styles.btnActionText}>{imageUri ? 'Replace' : 'Upload'}</Text>
        </TouchableOpacity>

        {imageUri && canDelete ? (
          <TouchableOpacity
            style={[styles.btnAction, { backgroundColor: isDark ? '#374151' : '#E5E7EB', marginLeft: spacing.xs }]}
            onPress={onRemove}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View> : isLocked ? (
        <Text style={styles.readOnlyText}>
          {isApproved ? 'Verified document · Read-only' : 'Submitted document · Read-only'}
        </Text>
      ) : null}
    </Card>
  );
}

function ReviewThumb({ label, uri }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

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

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
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
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  statusVerified: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#DCFCE7',
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  statusRejected: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEE2E2',
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4
  },
  verifiedBadge: {
    color: isDark ? '#34D399' : '#059669',
    fontSize: 10,
    fontWeight: '800'
  },
  retryProfileButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#374151' : colors.cardSecondary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  retryProfileText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  statusDesc: {
    fontSize: 12,
    color: colors.textSecondary,
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
    color: isDark ? '#34D399' : '#059669',
    flex: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2
  },
  sectionBadge: {
    backgroundColor: isDark ? '#2E1065' : '#EDE9FE',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  sectionBadgeText: {
    color: isDark ? '#DDD6FE' : colors.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md
  },
  docRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  docCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
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
    color: colors.textPrimary
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
    backgroundColor: isDark ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.3)',
    borderWidth: 1
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: isDark ? '#E5E7EB' : colors.textSecondary
  },
  previewContainer: {
    height: 110,
    borderRadius: 8,
    backgroundColor: isDark ? '#1F1B2E' : colors.cardSecondary,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
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
    color: colors.textMuted,
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
  readOnlyText: {
    color: isDark ? '#34D399' : '#059669',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 7
  },
  documentReviewNote: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs
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
    backgroundColor: colors.primary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: spacing.md
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  closeBtn: {
    padding: spacing.xs
  },
  snapshotCard: {
    backgroundColor: isDark ? '#1F1B2E' : colors.cardSecondary,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  snapshotLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  snapshotValue: {
    fontSize: 13,
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4
  },
  reviewThumbBox: {
    height: 90,
    borderRadius: 8,
    backgroundColor: isDark ? '#1F1B2E' : colors.cardSecondary,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
    paddingHorizontal: 2
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md
  },
  // Service Certification Card Styles
  certCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs
  },
  certFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6
  },
  certSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#161324' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    marginBottom: spacing.md
  },
  certSelectorText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
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
    color: colors.textSecondary,
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
    backgroundColor: isDark ? '#2D151B' : '#FEE2E2',
    borderWidth: 1,
    borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
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
    color: isDark ? '#FECACA' : '#991B1B',
    marginTop: 2
  },
  certRejectionSub: {
    fontSize: 10,
    color: isDark ? '#FCA5A5' : '#B91C1C',
    marginTop: 4,
    fontStyle: 'italic'
  },
  certPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#161324' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md
  },
  certFileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: isDark ? '#272042' : colors.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  certFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  certFileMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  certPlaceholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#161324' : colors.cardSecondary,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md
  },
  certPlaceholderText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 6
  },
  certPlaceholderSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2
  },
  certUploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: isDark ? '#251F3D' : colors.cardSecondary,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md
  },
  certUploadingText: {
    fontSize: 11,
    color: colors.primary,
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
  pickerCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  pickerCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  pickerCatCountBadge: {
    backgroundColor: isDark ? '#2E2845' : colors.cardSecondary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10
  },
  pickerCatCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary
  },
  pickerTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1F1B2E' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm
  },
  pickerTagItemSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? '#272042' : '#F5F3FF'
  },
  pickerTagName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  pickerTagSub: {
    fontSize: 11,
    color: colors.textSecondary
  },
  pickerTagIdText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.textMuted
  },
  activeTagBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  activeTagBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: isDark ? '#34D399' : '#059669'
  },
  pickerStateBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  pickerStateText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm
  },
  pickerErrorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: spacing.xs
  },
  pickerEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs
  },
  pickerStateSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: spacing.xs,
    maxWidth: 280
  },
  pickerRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginTop: spacing.sm
  },
  pickerRetryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  pickerNavigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginTop: spacing.sm
  },
  pickerNavigateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
