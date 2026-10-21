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
import colors from '../../theme/colors';

export default function LocationPermissionModal() {
  const {
    showPermissionModal,
    setShowPermissionModal,
    permissionStatus,
    requestPermission,
    openAppSettings,
    isLoading
  } = useLocation();

  if (!showPermissionModal) return null;

  const isBlocked = permissionStatus === 'blocked';

  return (
    <Modal
      visible={showPermissionModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPermissionModal(false)}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => setShowPermissionModal(false)}
      >
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconCircle}>
            <Ionicons name="location-sharp" size={32} color="#A78BFA" />
          </View>

          <Text style={styles.title}>
            {isBlocked ? 'Location Permission Required' : 'Enable Device Location'}
          </Text>

          <Text style={styles.description}>
            {isBlocked
              ? 'Location access is permanently disabled for this app. Please open App Settings and grant location permission to discover nearby service providers.'
              : 'Enable location to find service providers near you, estimate arrival times, and view accurate local rates.'}
          </Text>

          <View style={styles.buttonCol}>
            {isBlocked ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  openAppSettings();
                  setShowPermissionModal(false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Open Settings</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={requestPermission}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>
                  {isLoading ? 'Fetching Location...' : 'Enable Location'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowPermissionModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Not Now</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161420',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2742',
    padding: 24,
    alignItems: 'center'
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#261F3D',
    borderWidth: 1,
    borderColor: '#3D3160',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8
  },
  description: {
    fontSize: 13,
    color: '#9CA3AF',
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
    backgroundColor: colors.primary,
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
    fontWeight: '600',
    color: '#71717A'
  }
});
