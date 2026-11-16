import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { providerServiceAreaRadiusApi } from '../../services/api';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export const GPS_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3
};

export const GPS_ERROR_TYPES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SYSTEM_DENIED: 'SYSTEM_DENIED',
  POSITION_UNAVAILABLE: 'POSITION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  SERVICES_DISABLED: 'SERVICES_DISABLED',
  UNSUPPORTED: 'UNSUPPORTED',
  UNKNOWN: 'UNKNOWN'
};

export const PERMISSION_STATES = {
  NOT_REQUESTED: 'NOT_REQUESTED',
  REQUESTED: 'REQUESTED',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  PERMANENTLY_DENIED: 'PERMANENTLY_DENIED',
  SERVICES_DISABLED: 'SERVICES_DISABLED',
  TIMEOUT: 'TIMEOUT',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Web Geolocation detection with permission pre-check,
 * fallback for high accuracy failures, and error distinction.
 */
async function detectWebLocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const error = new Error('Geolocation is not supported by your browser.');
    error.errorType = GPS_ERROR_TYPES.UNSUPPORTED;
    throw error;
  }

  // Pre-check browser origin permission status if supported
  let browserPermState = 'prompt';
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permResult = await navigator.permissions.query({ name: 'geolocation' });
      browserPermState = permResult.state;
    } catch (e) {
      // Query not supported in some browsers
    }
  }

  if (browserPermState === 'denied') {
    const error = new Error(
      'Location permission is blocked in your browser. Please allow Location access in your browser settings, then click "Retry GPS".'
    );
    error.code = GPS_ERROR_CODES.PERMISSION_DENIED;
    error.errorType = GPS_ERROR_TYPES.PERMISSION_DENIED;
    throw error;
  }

  const getPositionPromise = (options) => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  try {
    const pos = await getPositionPromise({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };
  } catch (initialErr) {
    const code = initialErr.code;
    if (code === GPS_ERROR_CODES.POSITION_UNAVAILABLE || code === GPS_ERROR_CODES.TIMEOUT) {
      try {
        const fallbackPos = await getPositionPromise({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000
        });
        return {
          latitude: fallbackPos.coords.latitude,
          longitude: fallbackPos.coords.longitude,
          accuracy: fallbackPos.coords.accuracy
        };
      } catch (fallbackErr) {
        const fbCode = fallbackErr.code;
        const err = new Error();
        err.code = fbCode;
        if (fbCode === GPS_ERROR_CODES.TIMEOUT) {
          err.message =
            'GPS request timed out. Device took too long to acquire coordinates. Please click "Retry GPS" or switch to manual address entry.';
          err.errorType = GPS_ERROR_TYPES.TIMEOUT;
        } else if (fbCode === GPS_ERROR_CODES.POSITION_UNAVAILABLE) {
          err.message =
            'Unable to determine your GPS location. Satellite or network positioning could not be reached. Please click "Retry GPS" or switch to manual entry.';
          err.errorType = GPS_ERROR_TYPES.POSITION_UNAVAILABLE;
        } else {
          err.message = fallbackErr.message || 'Failed to detect location.';
          err.errorType = GPS_ERROR_TYPES.UNKNOWN;
        }
        throw err;
      }
    }

    if (code === GPS_ERROR_CODES.PERMISSION_DENIED) {
      const err = new Error();
      err.code = 1;
      if (browserPermState === 'granted') {
        err.errorType = GPS_ERROR_TYPES.SYSTEM_DENIED;
        err.message =
          'Location is Allowed in your browser, but access was denied by your operating system. In Windows Settings > Privacy & security > Location, ensure "Location services" and "Let desktop apps access your location" are ON.';
      } else {
        err.errorType = GPS_ERROR_TYPES.PERMISSION_DENIED;
        err.message =
          'Location permission was denied. Please allow location access in your browser prompt or address bar settings, or switch to manual address entry.';
      }
      throw err;
    }

    const finalErr = new Error(initialErr.message || 'Failed to detect location.');
    finalErr.code = code;
    finalErr.errorType = GPS_ERROR_TYPES.UNKNOWN;
    throw finalErr;
  }
}

/**
 * Native Android / iOS location detection with expo-location:
 * - Checks hardware location services (GPS toggle).
 * - Distinguishes foreground permission status and canAskAgain.
 * - Dispatches proper errors and allows seamless retry after settings.
 */
async function detectNativeLocation() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    const error = new Error(
      'Device location services (GPS) are turned off. Please turn on Location in your device quick settings, then tap "Retry GPS".'
    );
    error.errorType = GPS_ERROR_TYPES.SERVICES_DISABLED;
    throw error;
  }

  const perm = await Location.getForegroundPermissionsAsync();
  let status = perm.status;
  let canAskAgain = perm.canAskAgain;

  if (status !== 'granted') {
    if (canAskAgain) {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
      canAskAgain = req.canAskAgain;
    }
  }

  if (status !== 'granted') {
    const isPermanentlyDenied = canAskAgain === false;
    const error = new Error(
      isPermanentlyDenied
        ? 'Location permission is permanently denied for Provider App. Please tap "Open Settings" to enable Location in App Permissions, or enter your address manually.'
        : 'Location permission was denied. Please grant location access to detect your service area automatically, or enter your address manually.'
    );
    error.errorType = GPS_ERROR_TYPES.PERMISSION_DENIED;
    error.canAskAgain = canAskAgain;
    error.isPermanentlyDenied = isPermanentlyDenied;
    throw error;
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 15000
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };
  } catch (posErr) {
    const msg = (posErr.message || '').toLowerCase();
    const error = new Error();

    if (msg.includes('timeout') || msg.includes('timed out')) {
      error.message = 'GPS request timed out. Please tap "Retry GPS" or switch to manual address entry.';
      error.errorType = GPS_ERROR_TYPES.TIMEOUT;
    } else if (msg.includes('service') || msg.includes('disabled')) {
      error.message = 'Location services are disabled on your device. Please turn on GPS and retry.';
      error.errorType = GPS_ERROR_TYPES.SERVICES_DISABLED;
    } else {
      error.message =
        'Unable to acquire GPS coordinates. Please move to an open area, tap "Retry GPS", or enter your address manually.';
      error.errorType = GPS_ERROR_TYPES.POSITION_UNAVAILABLE;
    }
    throw error;
  }
}

export default function ServiceAreaRadiusModal({
  visible,
  onClose,
  serviceItem, // { category, serviceName, serviceArea, radiusRule }
  onSaved
}) {
  const [locationMode, setLocationMode] = useState('gps'); // 'gps' | 'manual'

  // Permission & GPS Detection State
  const [permissionState, setPermissionState] = useState(PERMISSION_STATES.NOT_REQUESTED);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsErrorDetail, setGpsErrorDetail] = useState(null); // { type, canAskAgain }
  const [detectedLocation, setDetectedLocation] = useState(null); // { latitude, longitude, address, formattedAddress }

  // Manual Address State
  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [selectedManualAddress, setSelectedManualAddress] = useState(null);
  const debounceTimerRef = useRef(null);

  // Radius Selection State
  const [selectedRadiusKm, setSelectedRadiusKm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // AppState & Settings Navigation Tracker
  const appStateRef = useRef(AppState.currentState);
  const waitingForSettingsReturnRef = useRef(false);

  // Check initial foreground location permission quietly on modal open
  const checkPermissionQuietly = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setPermissionState(PERMISSION_STATES.SERVICES_DISABLED);
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        setPermissionState(PERMISSION_STATES.GRANTED);
      } else if (perm.canAskAgain === false) {
        setPermissionState(PERMISSION_STATES.PERMANENTLY_DENIED);
      } else {
        setPermissionState(PERMISSION_STATES.DENIED);
      }
    } catch (e) {
      // Quiet check failure
    }
  }, []);

  // Initialize modal state from serviceItem
  useEffect(() => {
    if (visible && serviceItem) {
      setErrorMessage(null);
      setGpsError(null);
      setGpsErrorDetail(null);
      setAddressSuggestions([]);

      checkPermissionQuietly();

      const existing = serviceItem.serviceArea;
      if (existing) {
        setSelectedRadiusKm(existing.radiusKm);
        const source = existing.locationSource === 'manual' ? 'manual' : 'gps';
        setLocationMode(source);

        const locData = {
          latitude: existing.location?.coordinates?.[1] || 0,
          longitude: existing.location?.coordinates?.[0] || 0,
          address: existing.address || {},
          formattedAddress: existing.address?.formattedAddress || ''
        };

        if (source === 'gps') {
          setDetectedLocation(locData);
        } else {
          setSelectedManualAddress(locData);
          setManualQuery(locData.formattedAddress);
        }
      } else {
        // Default to first active radius option
        const activeOptions = (serviceItem.radiusRule?.allowedRadii || []).filter(
          (r) => r.isActive !== false
        );
        setSelectedRadiusKm(activeOptions[0]?.km || null);
        setDetectedLocation(null);
        setSelectedManualAddress(null);
        setManualQuery('');
        setLocationMode('gps');
      }
    }
  }, [visible, serviceItem, checkPermissionQuietly]);

  // Handle GPS Auto Detection
  const handleDetectLocation = async () => {
    setIsDetectingGps(true);
    setPermissionState(PERMISSION_STATES.REQUESTED);
    setGpsError(null);
    setGpsErrorDetail(null);

    try {
      let coords = null;
      if (Platform.OS === 'web') {
        coords = await detectWebLocation();
      } else {
        coords = await detectNativeLocation();
      }

      const { latitude: lat, longitude: lon } = coords;
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        throw new Error('Unable to obtain valid coordinates from location sensor.');
      }

      setPermissionState(PERMISSION_STATES.GRANTED);

      // Reverse geocode via backend proxy
      let addressData = {
        street: '',
        locality: '',
        city: '',
        state: '',
        zipCode: '',
        formattedAddress: `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`
      };

      try {
        const geoRes = await providerServiceAreaRadiusApi.reverseGeocode(lat, lon);
        if (geoRes?.success && geoRes.data) {
          addressData = {
            street: geoRes.data.street || '',
            locality: geoRes.data.locality || '',
            city: geoRes.data.city || '',
            state: geoRes.data.state || '',
            zipCode: geoRes.data.zipCode || '',
            formattedAddress: geoRes.data.formattedAddress || addressData.formattedAddress
          };
        }
      } catch (revErr) {
        // Fallback to coordinates string
      }

      setDetectedLocation({
        latitude: lat,
        longitude: lon,
        address: addressData,
        formattedAddress: addressData.formattedAddress
      });
      setGpsError(null);
      setGpsErrorDetail(null);
    } catch (err) {
      const errType = err.errorType || GPS_ERROR_TYPES.UNKNOWN;
      const canAskAgain = err.canAskAgain !== false;
      const isPermDenied = errType === GPS_ERROR_TYPES.PERMISSION_DENIED && !canAskAgain;

      if (errType === GPS_ERROR_TYPES.SERVICES_DISABLED) {
        setPermissionState(PERMISSION_STATES.SERVICES_DISABLED);
      } else if (isPermDenied) {
        setPermissionState(PERMISSION_STATES.PERMANENTLY_DENIED);
      } else if (errType === GPS_ERROR_TYPES.PERMISSION_DENIED) {
        setPermissionState(PERMISSION_STATES.DENIED);
      } else if (errType === GPS_ERROR_TYPES.TIMEOUT) {
        setPermissionState(PERMISSION_STATES.TIMEOUT);
      } else {
        setPermissionState(PERMISSION_STATES.UNAVAILABLE);
      }

      setGpsError(err.message || 'Failed to detect device location.');
      setGpsErrorDetail({
        type: errType,
        canAskAgain: canAskAgain
      });
      // NOTE: We deliberately do NOT wipe detectedLocation if the provider already had a saved area!
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Open App Settings when permission is permanently denied
  const handleOpenSettings = async () => {
    waitingForSettingsReturnRef.current = true;
    try {
      await Linking.openSettings();
    } catch (e) {
      Alert.alert(
        'Open Settings',
        'Please open device Settings > Apps > Provider App > Permissions and enable Location access.'
      );
    }
  };

  // Listen to AppState to automatically re-check permission after user returns from Settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        visible
      ) {
        if (waitingForSettingsReturnRef.current) {
          waitingForSettingsReturnRef.current = false;
          try {
            const perm = await Location.getForegroundPermissionsAsync();
            if (perm.status === 'granted') {
              setPermissionState(PERMISSION_STATES.GRANTED);
              setGpsError(null);
              setGpsErrorDetail(null);
              // Permission granted! Automatically retry GPS detection
              handleDetectLocation();
            } else {
              setPermissionState(
                perm.canAskAgain === false
                  ? PERMISSION_STATES.PERMANENTLY_DENIED
                  : PERMISSION_STATES.DENIED
              );
            }
          } catch (e) {
            // Permission re-check error
          }
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [visible]);

  // Search Address suggestions for Manual Entry
  const handleManualSearchChange = (text) => {
    setManualQuery(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text || text.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearchingManual(true);
      try {
        const res = await providerServiceAreaRadiusApi.searchAddress(text.trim());
        if (res?.success && Array.isArray(res.data)) {
          setAddressSuggestions(res.data);
        }
      } catch (err) {
        // Search error
      } finally {
        setIsSearchingManual(false);
      }
    }, 350);
  };

  // Select suggestion in Manual Mode
  const handleSelectSuggestion = (item) => {
    const locObj = {
      latitude: item.latitude,
      longitude: item.longitude,
      address: {
        street: item.street || '',
        locality: item.locality || '',
        city: item.city || '',
        state: item.state || '',
        zipCode: item.zipCode || '',
        formattedAddress: item.formattedAddress || ''
      },
      formattedAddress: item.formattedAddress
    };
    setSelectedManualAddress(locObj);
    setManualQuery(item.formattedAddress);
    setAddressSuggestions([]);
  };

  // Save Service Location & Radius
  const handleSave = async () => {
    setErrorMessage(null);

    if (!selectedRadiusKm) {
      setErrorMessage('Please select an Admin-approved service radius option.');
      return;
    }

    let targetCoords = null;
    let targetAddress = null;

    if (locationMode === 'gps') {
      if (!detectedLocation || !detectedLocation.latitude || !detectedLocation.longitude) {
        setErrorMessage('Please detect your GPS location first, or switch to manual entry.');
        return;
      }
      targetCoords = [detectedLocation.longitude, detectedLocation.latitude];
      targetAddress = detectedLocation.address;
    } else {
      if (!selectedManualAddress || !selectedManualAddress.latitude || !selectedManualAddress.longitude) {
        setErrorMessage('Please search and select a verified address from suggestions.');
        return;
      }
      targetCoords = [selectedManualAddress.longitude, selectedManualAddress.latitude];
      targetAddress = selectedManualAddress.address;
    }

    setIsSaving(true);
    try {
      const categoryId = serviceItem.category?._id || serviceItem.category;
      const payload = {
        categoryId,
        serviceName: serviceItem.serviceName,
        radiusKm: Number(selectedRadiusKm),
        address: targetAddress,
        coordinates: targetCoords,
        locationSource: locationMode
      };

      const res = await providerServiceAreaRadiusApi.updateServiceArea(payload);
      if (res?.success) {
        Alert.alert(
          'Service Area Saved',
          `Operational area and ${selectedRadiusKm} KM radius for ${serviceItem.serviceName} have been saved successfully.`
        );
        if (onSaved) onSaved(res.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.userMessage || err.message || 'Failed to save service area.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!serviceItem) return null;

  const maxRadiusKm = serviceItem.radiusRule?.maxRadiusKm || 15;
  const allowedRadii = (serviceItem.radiusRule?.allowedRadii || []).filter(
    (r) => r.isActive !== false && Number(r.km) <= maxRadiusKm
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={styles.modalTitle}>Set Service Area & Radius</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {serviceItem.serviceName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
          >
            {/* Top Error Alert */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            {/* STEP 1: OPERATIONAL LOCATION */}
            <View style={styles.stepHeaderRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step 1</Text>
              </View>
              <Text style={styles.sectionHeader}>Service Operational Location</Text>
            </View>
            <Text style={styles.hintText}>
              Set the center point from which your service delivery radius is calculated.
            </Text>

            {/* Mode Tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, locationMode === 'gps' && styles.modeTabActive]}
                onPress={() => setLocationMode('gps')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="navigate"
                  size={15}
                  color={locationMode === 'gps' ? colors.primaryLight : colors.textSecondary}
                />
                <Text
                  style={[styles.modeTabText, locationMode === 'gps' && styles.modeTabTextActive]}
                >
                  Option A: Detect GPS
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, locationMode === 'manual' && styles.modeTabActive]}
                onPress={() => setLocationMode('manual')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="search"
                  size={15}
                  color={locationMode === 'manual' ? colors.primaryLight : colors.textSecondary}
                />
                <Text
                  style={[styles.modeTabText, locationMode === 'manual' && styles.modeTabTextActive]}
                >
                  Option B: Enter Manually
                </Text>
              </TouchableOpacity>
            </View>

            {/* OPTION A: GPS AUTO DETECT */}
            {locationMode === 'gps' ? (
              <View style={styles.locationSection}>
                <Text style={styles.sectionSubHint}>
                  Use device GPS to determine your primary operational base.
                </Text>

                <TouchableOpacity
                  style={styles.gpsActionButton}
                  onPress={handleDetectLocation}
                  disabled={isDetectingGps}
                  activeOpacity={0.8}
                >
                  {isDetectingGps ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="locate" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.gpsActionText}>
                    {isDetectingGps ? 'Detecting Location...' : 'Automatically Detect My Location'}
                  </Text>
                </TouchableOpacity>

                {/* GPS Permission / Error Status Card */}
                {gpsError && (
                  <View style={styles.gpsStatusContainer}>
                    <View style={styles.gpsStatusHeader}>
                      <Ionicons
                        name={
                          permissionState === PERMISSION_STATES.TIMEOUT
                            ? 'timer-outline'
                            : permissionState === PERMISSION_STATES.SERVICES_DISABLED
                            ? 'power-outline'
                            : permissionState === PERMISSION_STATES.PERMANENTLY_DENIED
                            ? 'shield-outline'
                            : 'alert-circle-outline'
                        }
                        size={18}
                        color="#EF4444"
                      />
                      <Text style={styles.gpsStatusTitle}>
                        {permissionState === PERMISSION_STATES.PERMANENTLY_DENIED
                          ? 'Location Permission Permanently Denied'
                          : permissionState === PERMISSION_STATES.SERVICES_DISABLED
                          ? 'Device Location Services Off'
                          : permissionState === PERMISSION_STATES.TIMEOUT
                          ? 'GPS Request Timed Out'
                          : permissionState === PERMISSION_STATES.UNAVAILABLE
                          ? 'GPS Position Unavailable'
                          : 'Location Access Denied'}
                      </Text>
                    </View>

                    <Text style={styles.gpsStatusMessage}>{gpsError}</Text>

                    {/* Action buttons */}
                    <View style={styles.gpsStatusActions}>
                      {permissionState === PERMISSION_STATES.PERMANENTLY_DENIED ? (
                        <TouchableOpacity
                          style={styles.settingsActionButton}
                          onPress={handleOpenSettings}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="settings-outline" size={15} color="#FFFFFF" />
                          <Text style={styles.settingsActionText}>Open App Settings</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.retryActionButton}
                          onPress={handleDetectLocation}
                          activeOpacity={0.8}
                          disabled={isDetectingGps}
                        >
                          {isDetectingGps ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Ionicons name="refresh" size={14} color="#FFFFFF" />
                          )}
                          <Text style={styles.retryActionText}>
                            {isDetectingGps ? 'Retrying...' : 'Retry GPS'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.switchManualActionButton}
                        onPress={() => setLocationMode('manual')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="search" size={14} color={colors.primaryLight} />
                        <Text style={styles.switchManualActionText}>Switch to Manual Entry</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Confirmed GPS Location Card */}
                {detectedLocation && (
                  <View style={styles.confirmedLocationCard}>
                    <View style={styles.confirmedHeaderRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.confirmedTitle}>GPS Location Confirmed</Text>
                    </View>
                    <Text style={styles.confirmedAddressText}>
                      {detectedLocation.formattedAddress}
                    </Text>
                    <View style={styles.confirmedCoordsRow}>
                      <Text style={styles.confirmedCoordsText}>
                        Lat: {detectedLocation.latitude?.toFixed(6)} | Lon:{' '}
                        {detectedLocation.longitude?.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* OPTION B: MANUAL ADDRESS SEARCH */
              <View style={styles.locationSection}>
                <Text style={styles.sectionSubHint}>
                  Search your shop, house, locality, landmark, city, or postal code.
                </Text>

                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={18} color={colors.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search area, locality, city, PIN code..."
                    placeholderTextColor={colors.placeholder}
                    value={manualQuery}
                    onChangeText={handleManualSearchChange}
                  />
                  {isSearchingManual && (
                    <ActivityIndicator size="small" color={colors.primaryLight} />
                  )}
                  {manualQuery.length > 0 && !isSearchingManual && (
                    <TouchableOpacity
                      onPress={() => {
                        setManualQuery('');
                        setAddressSuggestions([]);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Suggestions List */}
                {addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color={colors.primaryLight}
                          style={{ marginTop: 2 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionTitle} numberOfLines={1}>
                            {[item.street, item.locality, item.city].filter(Boolean).join(', ') ||
                              item.formattedAddress}
                          </Text>
                          <Text style={styles.suggestionFull} numberOfLines={2}>
                            {item.formattedAddress}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Confirmed Manual Address Card */}
                {selectedManualAddress && (
                  <View style={styles.confirmedLocationCard}>
                    <View style={styles.confirmedHeaderRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                      <Text style={styles.confirmedTitle}>Resolved Manual Address</Text>
                    </View>
                    <Text style={styles.confirmedAddressText}>
                      {selectedManualAddress.formattedAddress}
                    </Text>
                    <View style={styles.confirmedCoordsRow}>
                      <Text style={styles.confirmedCoordsText}>
                        Lat: {selectedManualAddress.latitude?.toFixed(6)} | Lon:{' '}
                        {selectedManualAddress.longitude?.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2: SELECT SERVICE RADIUS */}
            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>Step 2</Text>
                </View>
                <Text style={styles.sectionHeader}>Service Operational Radius</Text>
              </View>
              <Text style={styles.hintText}>
                Select an Admin-approved coverage radius for {serviceItem.serviceName} (Max permitted:{' '}
                {maxRadiusKm} KM).
              </Text>

              {allowedRadii.length === 0 ? (
                <View style={styles.emptyRadiiBox}>
                  <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
                  <Text style={styles.emptyRadiiText}>
                    No radius options have been enabled by Admin for this service category yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.radiusOptionsGrid}>
                  {allowedRadii.map((rad) => {
                    const isSelected = Number(selectedRadiusKm) === Number(rad.km);
                    return (
                      <TouchableOpacity
                        key={rad._id || rad.km}
                        style={[styles.radiusCard, isSelected && styles.radiusCardSelected]}
                        onPress={() => setSelectedRadiusKm(rad.km)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioInnerCircle} />}
                        </View>
                        <Text
                          style={[styles.radiusNumber, isSelected && styles.radiusNumberSelected]}
                        >
                          {rad.km} KM
                        </Text>
                        <Text style={[styles.radiusCoverage, isSelected && styles.radiusCoverageSelected]}>
                          Within {rad.km} KM
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!selectedRadiusKm || isSaving) && styles.saveButtonDisabled
              ]}
              onPress={handleSave}
              disabled={!selectedRadiusKm || isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Confirm & Save Area</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    backgroundColor: colors.card, // #16141F solid dark card surface
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.borderLight, // #36314D visible subtle contrast
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary // #FFFFFF
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.secondary, // #A78BFA
    fontWeight: '600',
    marginTop: 2
  },
  closeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardSecondary
  },
  scrollBody: {
    padding: spacing.lg
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4
  },
  stepBadge: {
    backgroundColor: colors.primarySubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primaryDark
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryLight
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary // #FFFFFF
  },
  hintText: {
    fontSize: 12,
    color: colors.textSecondary, // #9CA3AF
    lineHeight: 17,
    marginBottom: spacing.sm
  },
  modeTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  modeTabActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryLight
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary
  },
  modeTabTextActive: {
    color: colors.primaryLight,
    fontWeight: '700'
  },
  locationSection: {
    padding: spacing.md,
    backgroundColor: colors.cardSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionSubHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs
  },
  gpsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs
  },
  gpsActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  gpsStatusContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs
  },
  gpsStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  gpsStatusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444'
  },
  gpsStatusMessage: {
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 17,
    marginVertical: 4
  },
  gpsStatusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 6
  },
  settingsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm
  },
  settingsActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  retryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm
  },
  retryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  switchManualActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm
  },
  switchManualActionText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '600'
  },
  confirmedLocationCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    marginTop: spacing.sm
  },
  confirmedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  confirmedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981'
  },
  confirmedAddressText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18
  },
  confirmedCoordsRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)'
  },
  confirmedCoordsText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#6EE7B7'
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 13
  },
  suggestionsContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xs,
    maxHeight: 180,
    overflow: 'hidden'
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  suggestionFull: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  radiusOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  radiusCard: {
    width: '30%',
    minWidth: 90,
    backgroundColor: colors.cardSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center'
  },
  radiusCardSelected: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryLight
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  radioCircleSelected: {
    borderColor: colors.primaryLight
  },
  radioInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight
  },
  radiusNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  radiusNumberSelected: {
    color: colors.primaryLight
  },
  radiusCoverage: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2
  },
  radiusCoverageSelected: {
    color: colors.secondary
  },
  emptyRadiiBox: {
    padding: spacing.lg,
    backgroundColor: colors.cardSecondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.xs
  },
  emptyRadiiText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#EF4444'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSecondary
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md
  },
  saveButtonDisabled: {
    opacity: 0.5
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
