import React, { useState, useEffect, useRef } from 'react';
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
  Linking
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

  // 1. Pre-check browser origin permission status if supported
  let browserPermState = 'prompt';
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permResult = await navigator.permissions.query({ name: 'geolocation' });
      browserPermState = permResult.state; // 'granted' | 'prompt' | 'denied'
    } catch (e) {
      // Some browsers don't support querying 'geolocation'
    }
  }

  if (browserPermState === 'denied') {
    const error = new Error(
      'Location permission is blocked in your browser. Please click the lock or site settings icon next to the address bar to allow Location access, then click "Retry GPS".'
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

  // 2. Attempt high accuracy first (GPS / Wi-Fi Triangulation)
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
    const code = initialErr.code; // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT

    // If initial error was POSITION_UNAVAILABLE or TIMEOUT, try low accuracy / cached / network IP
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
            'GPS location request timed out. Your device took too long to acquire coordinates. Please click "Retry GPS" or switch to manual address entry.';
          err.errorType = GPS_ERROR_TYPES.TIMEOUT;
        } else if (fbCode === GPS_ERROR_CODES.POSITION_UNAVAILABLE) {
          err.message =
            'Unable to determine your GPS location. Satellites or network positioning could not be reached. Please click "Retry GPS" or switch to manual address entry.';
          err.errorType = GPS_ERROR_TYPES.POSITION_UNAVAILABLE;
        } else {
          err.message = fallbackErr.message || 'Failed to detect location.';
          err.errorType = GPS_ERROR_TYPES.UNKNOWN;
        }
        throw err;
      }
    }

    // If code === 1 (PERMISSION_DENIED)
    if (code === GPS_ERROR_CODES.PERMISSION_DENIED) {
      const err = new Error();
      err.code = 1;
      // If browser site permission was already granted, the OS (Windows Location Service or desktop app permission) blocked Chrome
      if (browserPermState === 'granted') {
        err.errorType = GPS_ERROR_TYPES.SYSTEM_DENIED;
        err.message =
          'Location is Allowed in your browser, but access was denied by your operating system. In Windows Settings > Privacy & security > Location, ensure "Location services" and "Let desktop apps access your location" are ON. Alternatively, click "Switch to Manual Entry".';
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
 * - Checks if device location services (GPS hardware) are turned on.
 * - Checks and requests foreground permissions.
 * - Distinguishes between permissions, disabled service, timeout, and position unavailable.
 */
async function detectNativeLocation() {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    const error = new Error(
      'Device location services (GPS) are turned off. Please turn on Location/GPS in your device quick settings, then tap "Retry GPS".'
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
    const error = new Error(
      !canAskAgain
        ? 'Location permission is permanently denied for Provider App. Please tap "Open Settings" to enable Location in App Permissions, or enter your address manually.'
        : 'Location permission was denied. Please allow location access to automatically detect your service location, or enter your address manually.'
    );
    error.errorType = GPS_ERROR_TYPES.PERMISSION_DENIED;
    error.canAskAgain = canAskAgain;
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

  // GPS State
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [gpsErrorDetail, setGpsErrorDetail] = useState(null); // { type, code, canAskAgain }
  const [detectedLocation, setDetectedLocation] = useState(null); // { latitude, longitude, address }

  // Manual State
  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [selectedManualAddress, setSelectedManualAddress] = useState(null);
  const debounceTimerRef = useRef(null);

  // Radius Selection State
  const [selectedRadiusKm, setSelectedRadiusKm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Initialize from existing serviceArea if present
  useEffect(() => {
    if (visible && serviceItem) {
      setErrorMessage(null);
      setGpsError(null);
      setGpsErrorDetail(null);
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
  }, [visible, serviceItem]);

  // Handle GPS Auto Detection
  const handleDetectLocation = async () => {
    setIsDetectingGps(true);
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

      // Reverse geocode via backend proxy
      let addressData = {
        street: '',
        locality: '',
        city: '',
        state: '',
        zipCode: '',
        formattedAddress: `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`
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
        // Fallback to coordinates
      }

      setDetectedLocation({
        latitude: lat,
        longitude: lon,
        address: addressData,
        formattedAddress: addressData.formattedAddress
      });
    } catch (err) {
      setGpsError(err.message || 'Failed to detect device location.');
      setGpsErrorDetail({
        type: err.errorType || GPS_ERROR_TYPES.UNKNOWN,
        code: err.code || null,
        canAskAgain: err.canAskAgain !== false
      });
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Search Address suggestions for Manual Entry
  const handleManualSearchChange = (text) => {
    setManualQuery(text);
    setSelectedManualAddress(null);

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

  // Select suggestion
  const handleSelectSuggestion = (item) => {
    setSelectedManualAddress({
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
    });
    setManualQuery(item.formattedAddress);
    setAddressSuggestions([]);
  };

  // Save Service Location & Radius
  const handleSave = async () => {
    setErrorMessage(null);

    if (!selectedRadiusKm) {
      setErrorMessage('Please select a service radius option.');
      return;
    }

    let targetCoords = null;
    let targetAddress = null;

    if (locationMode === 'gps') {
      if (!detectedLocation) {
        setErrorMessage('Please click "Detect My Location" to acquire your GPS position first.');
        return;
      }
      targetCoords = [detectedLocation.longitude, detectedLocation.latitude];
      targetAddress = detectedLocation.address;
    } else {
      if (!selectedManualAddress) {
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
          `Your service location and ${selectedRadiusKm} KM radius for ${serviceItem.serviceName} have been updated successfully.`
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

  const allowedRadii = (serviceItem.radiusRule?.allowedRadii || []).filter(
    (r) => r.isActive !== false
  );
  const maxRadiusKm = serviceItem.radiusRule?.maxRadiusKm || 15;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Set Service Area & Radius</Text>
              <Text style={styles.modalSubtitle}>{serviceItem.serviceName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.slate400} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {errorMessage && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorBoxText}>{errorMessage}</Text>
              </View>
            )}

            {/* STEP 1: SELECT LOCATION MODE */}
            <Text style={styles.sectionHeader}>1. Select Your Service Location</Text>

            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, locationMode === 'gps' && styles.modeTabActive]}
                onPress={() => setLocationMode('gps')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="navigate"
                  size={16}
                  color={locationMode === 'gps' ? colors.primaryLight : colors.slate400}
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
                  size={16}
                  color={locationMode === 'manual' ? colors.primaryLight : colors.slate400}
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
                <Text style={styles.hintText}>
                  Use device GPS to determine your primary operational location for this service.
                </Text>

                <TouchableOpacity
                  style={styles.gpsActionButton}
                  onPress={handleDetectLocation}
                  disabled={isDetectingGps}
                  activeOpacity={0.8}
                >
                  {isDetectingGps ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="locate" size={18} color="#fff" />
                  )}
                  <Text style={styles.gpsActionText}>
                    {isDetectingGps ? 'Detecting Location...' : 'Automatically Detect My Location'}
                  </Text>
                </TouchableOpacity>

                {gpsError && (
                  <View style={styles.gpsErrorContainer}>
                    <View style={styles.gpsErrorHeader}>
                      <Ionicons
                        name={
                          gpsErrorDetail?.type === GPS_ERROR_TYPES.TIMEOUT
                            ? 'timer-outline'
                            : gpsErrorDetail?.type === GPS_ERROR_TYPES.POSITION_UNAVAILABLE
                            ? 'location-outline'
                            : gpsErrorDetail?.type === GPS_ERROR_TYPES.SERVICES_DISABLED
                            ? 'power-outline'
                            : 'alert-circle-outline'
                        }
                        size={18}
                        color={colors.danger}
                      />
                      <Text style={styles.gpsErrorTitle}>
                        {gpsErrorDetail?.type === GPS_ERROR_TYPES.TIMEOUT
                          ? 'GPS Request Timed Out'
                          : gpsErrorDetail?.type === GPS_ERROR_TYPES.POSITION_UNAVAILABLE
                          ? 'Location Position Unavailable'
                          : gpsErrorDetail?.type === GPS_ERROR_TYPES.SYSTEM_DENIED
                          ? 'Operating System Location Blocked'
                          : gpsErrorDetail?.type === GPS_ERROR_TYPES.SERVICES_DISABLED
                          ? 'Device Location Services Off'
                          : 'Location Permission Required'}
                      </Text>
                    </View>

                    <Text style={styles.gpsErrorText}>{gpsError}</Text>

                    <View style={styles.gpsErrorActions}>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={handleDetectLocation}
                        activeOpacity={0.8}
                        disabled={isDetectingGps}
                      >
                        {isDetectingGps ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons name="refresh" size={14} color="#fff" />
                        )}
                        <Text style={styles.retryButtonText}>
                          {isDetectingGps ? 'Retrying...' : 'Retry GPS'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.switchManualButton}
                        onPress={() => setLocationMode('manual')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="search" size={14} color={colors.primaryLight} />
                        <Text style={styles.switchManualButtonText}>Switch to Manual Entry</Text>
                      </TouchableOpacity>

                      {Platform.OS !== 'web' && gpsErrorDetail?.canAskAgain === false && (
                        <TouchableOpacity
                          style={styles.settingsButton}
                          onPress={() => Linking.openSettings()}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="settings-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.settingsButtonText}>Open Settings</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {detectedLocation && (
                  <View style={styles.detectedCard}>
                    <View style={styles.detectedRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.detectedTitle}>Detected Location Confirmed</Text>
                    </View>
                    <Text style={styles.detectedAddress}>
                      {detectedLocation.formattedAddress}
                    </Text>
                    <View style={styles.coordsRow}>
                      <Text style={styles.coordsText}>
                        Lat: {detectedLocation.latitude.toFixed(6)} | Lon:{' '}
                        {detectedLocation.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* OPTION B: MANUAL ADDRESS SEARCH */
              <View style={styles.locationSection}>
                <Text style={styles.hintText}>
                  Type your house, street, locality, city and PIN code.
                </Text>

                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={18} color={colors.slate400} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search address, locality, city, PIN..."
                    placeholderTextColor={colors.slate400}
                    value={manualQuery}
                    onChangeText={handleManualSearchChange}
                  />
                  {isSearchingManual && <ActivityIndicator size="small" color={colors.primary} />}
                </View>

                {/* Suggestions List */}
                {addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(item)}
                      >
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color={colors.primary}
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

                {selectedManualAddress && (
                  <View style={styles.detectedCard}>
                    <View style={styles.detectedRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.detectedTitle}>Resolved Address</Text>
                    </View>
                    <Text style={styles.detectedAddress}>
                      {selectedManualAddress.formattedAddress}
                    </Text>
                    <View style={styles.coordsRow}>
                      <Text style={styles.coordsText}>
                        Lat: {selectedManualAddress.latitude.toFixed(6)} | Lon:{' '}
                        {selectedManualAddress.longitude.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 2: SELECT SERVICE RADIUS */}
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionHeader}>2. Select Service Radius</Text>
              <Text style={styles.hintText}>
                Displaying only Admin-approved radius options for {serviceItem.serviceName} (Max permitted: {maxRadiusKm} KM).
              </Text>

              {allowedRadii.length === 0 ? (
                <View style={styles.emptyRadiiBox}>
                  <Text style={styles.emptyRadiiText}>
                    No radius options have been enabled by Admin for this service yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.radiusOptionsGrid}>
                  {allowedRadii.map((rad) => {
                    const isSelected = Number(selectedRadiusKm) === Number(rad.km);
                    return (
                      <TouchableOpacity
                        key={rad._id || rad.km}
                        style={[
                          styles.radiusCard,
                          isSelected && styles.radiusCardSelected
                        ]}
                        onPress={() => setSelectedRadiusKm(rad.km)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.radioIndicator}>
                          {isSelected && <View style={styles.radioInnerCircle} />}
                        </View>
                        <Text
                          style={[
                            styles.radiusNumber,
                            isSelected && styles.radiusNumberSelected
                          ]}
                        >
                          {rad.km} KM
                        </Text>
                        <Text style={styles.radiusCoverage}>
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
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
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

const defaultFontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20
};

const defaultFontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700'
};

const fontSizes = typography?.fontSize || defaultFontSize;
const fontWeights = typography?.fontWeight || defaultFontWeight;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text
  },
  modalSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.primaryLight,
    fontWeight: fontWeights.semibold,
    marginTop: 2
  },
  closeButton: {
    padding: spacing.xs
  },
  scrollBody: {
    padding: spacing.md
  },
  sectionHeader: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs
  },
  hintText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm
  },
  modeTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  modeTabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: colors.primaryLight
  },
  modeTabText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.textMuted
  },
  modeTabTextActive: {
    color: colors.primaryLight,
    fontWeight: fontWeights.bold
  },
  locationSection: {
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  gpsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs
  },
  gpsActionText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold
  },
  detectedCard: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: spacing.sm
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  detectedTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.success
  },
  detectedAddress: {
    fontSize: fontSizes.xs,
    color: colors.text,
    lineHeight: 18
  },
  coordsRow: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  coordsText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.textMuted
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSizes.xs
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    maxHeight: 180
  },
  suggestionItem: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  suggestionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.text
  },
  suggestionFull: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1
  },
  radiusOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  radiusCard: {
    width: '30%',
    minWidth: 90,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center'
  },
  radiusCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: colors.primaryLight
  },
  radioIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.slate400,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  radioInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryLight
  },
  radiusNumber: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.text
  },
  radiusNumberSelected: {
    color: colors.primaryLight
  },
  radiusCoverage: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2
  },
  emptyRadiiBox: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center'
  },
  emptyRadiiText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center'
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm
  },
  errorBoxText: {
    flex: 1,
    fontSize: fontSizes.xs,
    color: colors.danger
  },
  gpsErrorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs
  },
  gpsErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  gpsErrorTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.danger
  },
  gpsErrorText: {
    fontSize: fontSizes.xs,
    color: colors.text,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: spacing.xs
  },
  gpsErrorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 6
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm
  },
  retryButtonText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold
  },
  switchManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm
  },
  switchManualButtonText: {
    color: colors.primaryLight,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm
  },
  settingsButtonText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  cancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  cancelButtonText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.textMuted
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md
  },
  saveButtonDisabled: {
    opacity: 0.5
  },
  saveButtonText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold
  }
});

