import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../context/LocationContext';
import { useTheme } from '../../context/ThemeContext';

export default function LocationPermissionModal() {
  const { colors, isDark } = useTheme();
  const {
    showPermissionModal,
    setShowPermissionModal,
    dismissPermissionModal,
    permissionStatus,
    requestPermission,
    openAppSettings,
    isLoading
  } = useLocation();

  if (!showPermissionModal) return null;

  const isBlocked = permissionStatus === 'blocked';
  const handleClose = dismissPermissionModal || (() => setShowPermissionModal(false));

  return (
    <Modal
      visible={showPermissionModal}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={handleClose}
      >
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.primarySubtle,
                borderColor: colors.borderLight
              }
            ]}
          >
            <Ionicons name="location-sharp" size={32} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isBlocked ? 'Location Permission Required' : 'Enable Device Location'}
          </Text>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {isBlocked
              ? 'Location access is permanently disabled for this app. Please open App Settings and grant location permission to discover nearby service providers.'
              : 'Enable location to find service providers near you, estimate arrival times, and view accurate local rates.'}
          </Text>

          <View style={styles.buttonCol}>
            {isBlocked ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  openAppSettings();
                  handleClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>Open App Settings</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  await requestPermission();
                }}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  {isLoading ? 'Checking...' : 'Allow Location Access'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                Not Now / Enter Manually
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center'
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  buttonCol: {
    width: '100%',
    gap: 10
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  cancelBtn: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600'
  }
});
