import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { categoryApi, serviceApi, providerApi } from '../../services/api';
import { Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { PRICING_LABELS } from '../../constants';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [featuredServices, setFeaturedServices] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [catRes, servRes, provRes] = await Promise.all([
        categoryApi.getAll(),
        serviceApi.getAll({ limit: 6 }),
        providerApi.getAll({ limit: 4 })
      ]);

      setCategories(catRes.data || []);
      setFeaturedServices(servRes.data || []);
      setTopProviders(provRes.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load marketplace data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return <LoadingScreen message="Loading marketplace services..." />;
  }

  if (error && categories.length === 0 && featuredServices.length === 0) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <ErrorView message={error} onRetry={fetchData} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingSub}>Welcome back,</Text>
          <Text style={styles.greetingTitle}>{user?.name || 'Customer'}</Text>
        </View>
        <TouchableOpacity
          style={styles.searchShortcut}
          onPress={() => navigation.navigate('ServicesTab')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color={colors.slate600} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Banner Card */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTextCol}>
            <Badge label="Verified Services" variant="primary" size="sm" style={styles.bannerBadge} />
            <Text style={styles.bannerHeading}>Need a trusted service professional?</Text>
            <Text style={styles.bannerSubtext}>
              Explore verified local experts ready to help today.
            </Text>
          </View>
          <View style={styles.bannerIconWrapper}>
            <Ionicons name="construct" size={36} color={colors.primary} />
          </View>
        </View>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service Categories</Text>
        </View>

        {categories.length === 0 ? (
          <EmptyState
            icon="albums-outline"
            title="No Categories Available"
            description="Active categories will appear here once configured."
          />
        ) : (
          <View style={styles.categoriesGrid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat._id}
                style={styles.categoryCard}
                onPress={() =>
                  navigation.navigate('CategoryServices', {
                    categoryId: cat._id,
                    categoryName: cat.name,
                    categoryDescription: cat.description
                  })
                }
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconCircle}>
                  <Ionicons name="grid" size={24} color={colors.primary} />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Featured Services Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Popular Services</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ServicesTab')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {featuredServices.length === 0 ? (
          <EmptyState
            icon="briefcase-outline"
            title="No Services Found"
            description="Active marketplace services will appear here."
          />
        ) : (
          <View style={styles.servicesList}>
            {featuredServices.map((service) => (
              <Card
                key={service._id}
                style={styles.serviceCard}
                onPress={() =>
                  navigation.navigate('ServiceDetail', { serviceId: service._id })
                }
              >
                <View style={styles.serviceHeaderRow}>
                  <Text style={styles.serviceName} numberOfLines={1}>
                    {service.name}
                  </Text>
                  <Badge
                    label={PRICING_LABELS[service.pricingType] || service.pricingType}
                    variant="slate"
                    size="sm"
                  />
                </View>
                <Text style={styles.serviceCategory}>
                  {service.category?.name || 'General'}
                </Text>
                {service.description ? (
                  <Text style={styles.serviceDesc} numberOfLines={2}>
                    {service.description}
                  </Text>
                ) : null}
                <View style={styles.serviceFooter}>
                  <Text style={styles.servicePrice}>
                    ₹{service.basePrice?.toLocaleString('en-IN') || 0}
                  </Text>
                  {service.duration ? (
                    <View style={styles.durationRow}>
                      <Ionicons name="time-outline" size={14} color={colors.slate400} />
                      <Text style={styles.durationText}>{service.duration} mins</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Verified Providers Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Verified Providers</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ProvidersTab')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {topProviders.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No Providers Available"
            description="Verified service providers will appear here once approved."
          />
        ) : (
          <View style={styles.providersList}>
            {topProviders.map((provider) => (
              <Card
                key={provider._id}
                style={styles.providerCard}
                onPress={() =>
                  navigation.navigate('ProviderDetail', { providerId: provider._id })
                }
              >
                <View style={styles.providerRow}>
                  <View style={styles.providerAvatar}>
                    <Ionicons name="business" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.providerInfo}>
                    <View style={styles.providerNameRow}>
                      <Text style={styles.providerName} numberOfLines={1}>
                        {provider.businessName || provider.user?.name || 'Service Provider'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    </View>
                    <Text style={styles.providerSub} numberOfLines={1}>
                      {provider.serviceCategories?.map((c) => c.name || c).join(', ') || 'Local Services'}
                    </Text>
                    <View style={styles.providerMetaRow}>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={styles.ratingText}>
                          {provider.rating ? provider.rating.toFixed(1) : 'New'}
                        </Text>
                      </View>
                      {provider.experienceYears ? (
                        <Text style={styles.metaExp}>
                          • {provider.experienceYears} yrs exp
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  greetingContainer: {
    flex: 1
  },
  greetingSub: {
    ...typography.caption,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  greetingTitle: {
    ...typography.titleMedium,
    color: colors.slate900
  },
  searchShortcut: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  bannerTextCol: {
    flex: 1
  },
  bannerBadge: {
    marginBottom: spacing.xs
  },
  bannerHeading: {
    ...typography.titleSmall,
    color: colors.primaryDark,
    marginBottom: 4
  },
  bannerSubtext: {
    ...typography.bodySmall,
    color: colors.slate600
  },
  bannerIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
    ...shadows.card
  },
  sectionHeader: {
    marginBottom: spacing.md
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  viewAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600'
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs
  },
  categoryCard: {
    width: '30%',
    margin: '1.66%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card
  },
  categoryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  categoryName: {
    ...typography.caption,
    color: colors.slate800,
    textAlign: 'center',
    fontWeight: '600'
  },
  servicesList: {
    gap: spacing.md
  },
  serviceCard: {
    marginBottom: spacing.xs
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.slate900,
    flex: 1,
    marginRight: spacing.sm
  },
  serviceCategory: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs
  },
  serviceDesc: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginBottom: spacing.md
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm
  },
  servicePrice: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  durationText: {
    ...typography.caption,
    color: colors.slate500
  },
  providersList: {
    gap: spacing.md
  },
  providerCard: {
    marginBottom: spacing.xs
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  providerInfo: {
    flex: 1
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  providerName: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '600',
    flexShrink: 1
  },
  providerSub: {
    ...typography.caption,
    color: colors.slate500,
    marginBottom: 4
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E'
  },
  metaExp: {
    ...typography.caption,
    color: colors.slate400,
    marginLeft: spacing.sm
  }
});
