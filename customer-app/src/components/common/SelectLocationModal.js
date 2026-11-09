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
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../context/LocationContext';
import { locationApi } from '../../services/api';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function SelectLocationModal({
  visible,
  onClose,
  onLocationSelected,
  initialLocation
}) {
  const {
    location: contextLocation,
    fetchCurrentLocation,
    requestPermission,
    permissionStatus,
    setManualLocation
  } = useLocation();

  const [activeTab, setActiveTab] = useState('gps'); // 'gps' | 'manual'

  // GPS state
  const [isDetecting, setIsDetecting] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [detectedLocation, setDetectedLocation] = useState(initialLocation || contextLocation || null);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedManual, setSelectedManual] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (initialLocation || contextLocation) {
        setDetectedLocation(initialLocation || contextLocation);
      }
      setGpsError(null);
    }
  }, [visible, initialLocation, contextLocation]);

  // Handle GPS Auto Detection (Option A)
  const handleUseCurrentLocation = async () => {
    setIsDetecting(true);
    setGpsError(null);
    try {
      const loc = await requestPermission();
      if (loc) {
        setDetectedLocation(loc);
      } else {
        setGpsError(
          'Location permission was not granted. You can use Option B below to enter your address manually without needing permission.'
        );
      }
    } catch (err) {
      setGpsError(err.message || 'Could not detect your current location.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Search Address suggestions for Manual Entry (Option B)
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setSelectedManual(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!text || text.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await locationApi.searchAddress(text.trim());
        if (res?.success && Array.isArray(res.data)) {
          setSuggestions(res.data);
        }
      } catch (err) {
        // Search error
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Select suggestion
  const handleSelectSuggestion = (item) => {
    const manualObj = {
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city || 'Custom Location',
      state: item.state || '',
      street: item.street || '',
      locality: item.locality || '',
      zipCode: item.zipCode || '',
      formattedAddress: item.formattedAddress,
      isManual: true,
      updatedAt: Date.now()
    };

    setSelectedManual(manualObj);
    setSearchQuery(item.formattedAddress);
    setSuggestions([]);
  };

  // Confirm selection
  const handleConfirm = async () => {
    let chosenLocation = null;
    if (activeTab === 'gps') {
      if (!detectedLocation) {
        Alert.alert('Location Required', 'Please click "Detect My Location" first or enter your address manually.');
        return;
      }
      chosenLocation = detectedLocation;
    } else {
      if (!selectedManual) {
        Alert.alert('Address Required', 'Please search and select your service address from the suggestions.');
        return;
      }
      chosenLocation = selectedManual;
    }

    await setManualLocation(chosenLocation);
    if (onLocationSelected) {
      onLocationSelected(chosenLocation);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Choose Service Location</Text>
              <Text style={styles.modalSubtitle}>
                Only providers within radius of your service address will be shown.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.slate400} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
            {/* Mode Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'gps' && styles.tabBtnActive]}
                onPress={() => setActiveTab('gps')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="navigate"
                  size={16}
                  color={activeTab === 'gps' ? colors.primary : colors.slate400}
                />
                <Text style={[styles.tabBtnText, activeTab === 'gps' && styles.tabBtnTextActive]}>
                  Use My Current Location
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'manual' && styles.tabBtnActive]}
                onPress={() => setActiveTab('manual')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={activeTab === 'manual' ? colors.primary : colors.slate400}
                />
                <Text style={[styles.tabBtnText, activeTab === 'manual' && styles.tabBtnTextActive]}>
                  Enter Location Manually
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB A: GPS AUTO DETECT */}
            {activeTab === 'gps' ? (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHint}>
                  Request location permission and automatically pinpoint your delivery address.
                </Text>

                <TouchableOpacity
                  style={styles.gpsBtn}
                  onPress={handleUseCurrentLocation}
                  disabled={isDetecting}
                  activeOpacity={0.8}
                >
                  {isDetecting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="locate" size={18} color="#fff" />
                  )}
                  <Text style={styles.gpsBtnText}>
                    {isDetecting ? 'Detecting Location...' : 'Detect Current GPS Location'}
                  </Text>
                </TouchableOpacity>

                {gpsError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={styles.errorText}>{gpsError}</Text>
                  </View>
                )}

                {detectedLocation && (
                  <View style={styles.confirmedBox}>
                    <View style={styles.confirmedTitleRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.confirmedTitle}>Service Location Confirmed</Text>
                    </View>
                    <Text style={styles.confirmedAddress}>
                      {detectedLocation.formattedAddress || 'Current Location'}
                    </Text>
                    <Text style={styles.coordsText}>
                      Coordinates: {detectedLocation.latitude?.toFixed(5)},{' '}
                      {detectedLocation.longitude?.toFixed(5)}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* TAB B: MANUAL SEARCH */
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHint}>
                  Search by house, street, locality, area, city or PIN code without requiring device location permission.
                </Text>

                <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={colors.slate400} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search street, locality, city, PIN code..."
                    placeholderTextColor={colors.slate400}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                  />
                  {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
                </View>

                {/* Suggestions List */}
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {suggestions.map((item, idx) => (
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
                          <Text style={styles.suggestionSub} numberOfLines={2}>
                            {item.formattedAddress}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selectedManual && (
                  <View style={styles.confirmedBox}>
                    <View style={styles.confirmedTitleRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.confirmedTitle}>Selected Address Confirmed</Text>
                    </View>
                    <Text style={styles.confirmedAddress}>
                      {selectedManual.formattedAddress}
                    </Text>
                    <Text style={styles.coordsText}>
                      Coordinates: {selectedManual.latitude?.toFixed(5)},{' '}
                      {selectedManual.longitude?.toFixed(5)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: colors.border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    color: colors.textMuted,
    marginTop: 2
  },
  closeBtn: {
    padding: spacing.xs
  },
  modalBody: {
    padding: spacing.md
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border
  },
  tabBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: colors.primary
  },
  tabBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.textMuted
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.bold
  },
  sectionContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  sectionHint: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold
  },
  confirmedBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginTop: spacing.xs
  },
  confirmedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  confirmedTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.success
  },
  confirmedAddress: {
    fontSize: fontSizes.xs,
    color: colors.text,
    lineHeight: 18
  },
  coordsText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4
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
  errorText: {
    flex: 1,
    fontSize: fontSizes.xs,
    color: colors.danger
  },
  searchBar: {
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
  suggestionsBox: {
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
  suggestionSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  cancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  cancelBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.textMuted
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold
  }
});

