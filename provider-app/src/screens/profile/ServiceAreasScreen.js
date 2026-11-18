import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { providerServiceAreaRadiusApi } from '../../services/api';
import { Header, Card, Badge, Button } from '../../components/common';
import ServiceAreaRadiusModal from '../../components/services/ServiceAreaRadiusModal';
import { spacing, typography, borderRadius } from '../../theme';

export default function ServiceAreasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServiceItem, setSelectedServiceItem] = useState(null);

  const fetchServiceAreas = useCallback(async () => {
    try {
      const res = await providerServiceAreaRadiusApi.getServiceAreas();
      if (res?.success && Array.isArray(res.data?.services)) {
        setServices(res.data.services);
      }
    } catch (err) {
      console.warn('Error loading provider service areas:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServiceAreas();
  }, [fetchServiceAreas]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServiceAreas();
    setRefreshing(false);
  };

  const handleOpenConfigure = (serviceItem) => {
    setSelectedServiceItem(serviceItem);
    setModalVisible(true);
  };

  const configuredCount = services.filter((s) => s.isConfigured).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title="Service Areas & Radius"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Info Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerIconContainer}>
            <Ionicons name="compass" size={24} color="#A78BFA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Service-Level Radius System</Text>
            <Text style={styles.bannerSub}>
              Set GPS or manual service location and choose from Admin-approved coverage radii (KM) for each service.
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{services.length}</Text>
            <Text style={styles.statLabel}>Total Services</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {configuredCount}
            </Text>
            <Text style={styles.statLabel}>Active Areas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
              {services.length - configuredCount}
            </Text>
            <Text style={styles.statLabel}>Not Set</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading service area configurations...</Text>
          </View>
        ) : services.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={48} color={colors.slate400} />
            <Text style={styles.emptyTitle}>No Services Selected</Text>
            <Text style={styles.emptySub}>
              Select your service tags under "Services" first to configure service areas.
            </Text>
          </View>
        ) : (
          services.map((item) => {
            const isConfigured = item.isConfigured;
            const area = item.serviceArea;
            const rule = item.radiusRule;

            return (
              <View
                key={item.category?._id || item.serviceName}
                style={styles.serviceAreaCard}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceTitle}>{item.serviceName}</Text>
                    <Text style={styles.serviceSubtitle}>
                      Permitted Radius: Up to {rule?.maxRadiusKm || 15} KM
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isConfigured ? styles.statusActive : styles.statusPending
                    ]}
                  >
                    <Ionicons
                      name={isConfigured ? 'checkmark-circle' : 'alert-circle'}
                      size={12}
                      color={isConfigured ? '#10B981' : '#F59E0B'}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        isConfigured ? styles.statusTextActive : styles.statusTextPending
                      ]}
                    >
                      {isConfigured ? 'Active' : 'Not Set'}
                    </Text>
                  </View>
                </View>

                {isConfigured ? (
                  <View style={styles.detailsBox}>
                    <View style={styles.detailRow}>
                      <Ionicons name="location" size={16} color="#A78BFA" />
                      <Text style={styles.addressText} numberOfLines={2}>
                        {area?.address?.formattedAddress || 'Service Address'}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.badgePill}>
                        <Ionicons name="radio" size={11} color="#10B981" />
                        <Text style={styles.badgePillText}>{area?.radiusKm} KM Radius</Text>
                      </View>
                      <View style={styles.badgePill}>
                        <Ionicons name="navigate" size={11} color="#60A5FA" />
                        <Text style={styles.badgePillText}>
                          {area?.locationSource === 'manual' ? 'Manual Address' : 'GPS Detected'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.warningBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
                    <Text style={styles.warningText}>
                      Configure a service location and radius so customers in your area can find you.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, isConfigured && styles.actionBtnConfigured]}
                  onPress={() => handleOpenConfigure(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isConfigured ? 'create-outline' : 'location-outline'}
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionBtnText}>
                    {isConfigured ? 'Update Location & Radius' : 'Set Service Location & Radius'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Service Area & Radius Modal */}
      <ServiceAreaRadiusModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedServiceItem(null);
        }}
        serviceItem={selectedServiceItem}
        onSaved={() => {
          fetchServiceAreas();
        }}
      />
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.md
  },
  bannerCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: isDark ? '#1E1B2E' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  bannerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#2A2440' : colors.card,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bannerTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary
  },
  bannerSub: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '600'
  },
  centered: {
    padding: spacing.xl,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.sm
  },
  emptySub: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4
  },
  serviceAreaCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  serviceTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary
  },
  serviceSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700'
  },
  statusTextActive: {
    color: '#10B981'
  },
  statusTextPending: {
    color: '#F59E0B'
  },
  detailsBox: {
    backgroundColor: isDark ? '#100E17' : colors.cardSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  addressText: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: isDark ? '#1E1B2E' : colors.border,
    borderRadius: 4
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textPrimary
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm
  },
  warningText: {
    fontSize: 11,
    color: '#F59E0B',
    flex: 1
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: borderRadius.md
  },
  actionBtnConfigured: {
    backgroundColor: isDark ? '#2E2845' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  actionBtnText: {
    color: isDark ? '#FFFFFF' : colors.primary,
    fontSize: 12,
    fontWeight: '700'
  }
});
