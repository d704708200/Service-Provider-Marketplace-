import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const STORAGE_KEYS = {
  HAS_REQUESTED_PERMISSION: '@mendroo_has_requested_location_permission',
  SAVED_LOCATION: '@mendroo_last_saved_location'
};

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null); // { latitude, longitude, city, state, formattedAddress }
  const [permissionStatus, setPermissionStatus] = useState('undetermined'); // 'undetermined' | 'granted' | 'denied' | 'blocked'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Load cached location on startup
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_LOCATION);
        if (cached) {
          setLocation(JSON.parse(cached));
        }
      } catch (e) {
        // Ignore cache read failures
      }
    })();
  }, []);

  // Check current permission without prompting
  const checkPermission = useCallback(async () => {
    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
        return 'granted';
      }
      if (!canAskAgain) {
        setPermissionStatus('blocked');
        return 'blocked';
      }
      if (status === 'denied') {
        setPermissionStatus('denied');
        return 'denied';
      }
      setPermissionStatus('undetermined');
      return 'undetermined';
    } catch (e) {
      setPermissionStatus('undetermined');
      return 'undetermined';
    }
  }, []);

  // Fetch coordinates and reverse geocode
  const fetchCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Verify location services enabled (GPS)
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServicesEnabled) {
        setError('Location services are turned off. Please enable GPS.');
        setIsLoading(false);
        return null;
      }

      // 2. Fetch position with balanced accuracy for fast response & low battery consumption
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 12000
      });

      const { latitude, longitude } = position.coords;

      // 3. Reverse geocode to get human-readable city & locality
      let city = 'Current Location';
      let state = '';
      let formattedAddress = 'Near you';

      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          const item = geocode[0];
          city = item.city || item.subregion || item.district || item.name || 'Current Location';
          state = item.region || item.country || '';
          formattedAddress = [item.name, item.district || item.city, item.region]
            .filter(Boolean)
            .join(', ');
        }
      } catch (geoErr) {
        // Geocoding failure non-fatal; coordinates are still valid
      }

      const newLoc = {
        latitude,
        longitude,
        city,
        state,
        formattedAddress,
        updatedAt: Date.now()
      };

      setLocation(newLoc);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_LOCATION, JSON.stringify(newLoc));
      setIsLoading(false);
      return newLoc;
    } catch (err) {
      const errMsg = err?.message || 'Failed to determine current location.';
      setError(errMsg);
      setIsLoading(false);
      return null;
    }
  }, []);

  // Request location permission & fetch if granted
  const requestPermission = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.HAS_REQUESTED_PERMISSION, 'true');
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setPermissionStatus('granted');
        setShowPermissionModal(false);
        return await fetchCurrentLocation();
      }

      if (!canAskAgain) {
        setPermissionStatus('blocked');
      } else {
        setPermissionStatus('denied');
      }
      setShowPermissionModal(false);
      return null;
    } catch (err) {
      setError('Unable to request location permission.');
      setShowPermissionModal(false);
      return null;
    }
  }, [fetchCurrentLocation]);

  // Open OS system settings if permanently blocked
  const openAppSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  // Trigger location flow on user click or startup
  const promptLocationFlow = useCallback(async (isUserInitiated = false) => {
    const status = await checkPermission();

    if (status === 'granted') {
      return await fetchCurrentLocation();
    }

    if (status === 'blocked') {
      if (isUserInitiated) {
        // Let the user know they can open settings
        setShowPermissionModal(true);
      }
      return null;
    }

    // Undetermined or denied:
    if (isUserInitiated) {
      setShowPermissionModal(true);
    } else {
      // Auto startup: check if we've already asked before; if never asked, show modal
      const hasAsked = await AsyncStorage.getItem(STORAGE_KEYS.HAS_REQUESTED_PERMISSION);
      if (!hasAsked) {
        setShowPermissionModal(true);
      }
    }
    return null;
  }, [checkPermission, fetchCurrentLocation]);

  // Set manual location (e.g. from address selector or preset)
  const setManualLocation = useCallback(async (manualLoc) => {
    setLocation(manualLoc);
    setError(null);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_LOCATION, JSON.stringify(manualLoc));
    } catch (e) {
      // Ignore storage errors
    }
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        permissionStatus,
        isLoading,
        error,
        showPermissionModal,
        setShowPermissionModal,
        checkPermission,
        requestPermission,
        fetchCurrentLocation,
        openAppSettings,
        promptLocationFlow,
        setManualLocation
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;
