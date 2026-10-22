import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerApi, reviewApi, serviceApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView } from '../../components/common';
import { formatRating, formatReviewCount, formatExperience } from '../../utils/formatters';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../theme';

export default function ProviderDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { providerId, selectedServiceId, serviceId } = route.params || {};
  const targetServiceId = selectedServiceId || serviceId;

  const [provider, setProvider] = useState(null);
  const [providerReviews, setProviderReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const [res, reviewsRes] = await Promise.all([
        providerApi.getById(providerId),
        reviewApi.getProviderReviews(providerId, { limit: 10 }).catch(() => null)
      ]);
      const providerData = res?.data;
      const providerSpecificServices = Array.isArray(providerData?.services) ? providerData.services : [];

      // Extract all unique category IDs registered to this provider
      const rawCategories = Array.isArray(providerData?.categories)
        ? providerData.categories
        : Array.isArray(providerData?.serviceCategories)
        ? providerData.serviceCategories
        : [];

      const categoryIds = [
        ...new Set(
          rawCategories
            .map((c) => (c && typeof c === 'object' ? c._id || c.id : c))
            .filter((id) => typeof id === 'string' && id.trim().length > 0)
        )
      ];

      // Prioritize provider's own saved services from their catalog
      const providerUserId = providerData?.user?._id || providerData?.user;
      const ownServices = providerSpecificServices.filter(
        (s) => s && s.provider && (
          String(s.provider._id || s.provider) === String(providerId) ||
          (providerUserId && String(s.provider._id || s.provider) === String(providerUserId))
        )
      );

      let combinedServices = ownServices.length > 0 ? ownServices : providerSpecificServices;

      // Only fetch catalog template services if provider has zero services configured
      if (combinedServices.length === 0 && categoryIds.length > 0) {
        try {
          const catalogResponses = await Promise.all(
            categoryIds.map((catId) =>
              serviceApi.getAll({ category: catId }).catch((catErr) => {
                console.warn(`Could not fetch catalog services for category ${catId}:`, catErr.message);
                return null;
              })
            )
          );

          const catalogServices = [];
          catalogResponses.forEach((srvRes) => {
            const list = Array.isArray(srvRes?.data)
              ? srvRes.data
              : Array.isArray(srvRes?.data?.services)
              ? srvRes.data.services
              : [];
            catalogServices.push(...list);
          });

          const seenServiceIds = new Set();
          for (const srv of catalogServices) {
            if (!srv || !srv._id) continue;
            const sid = String(srv._id);
            if (!seenServiceIds.has(sid)) {
              seenServiceIds.add(sid);
              combinedServices.push(srv);
            }
          }
        } catch (catErr) {
          console.warn('Could not fetch catalog services for provider categories:', catErr.message);
        }
      }

      const enrichedProvider = { ...providerData, services: combinedServices };
      setProvider(enrichedProvider);

      console.log('[Diagnostic: ProviderDetailScreen]', {
        providerId,
        businessName: enrichedProvider?.businessName,
        servicesCount: combinedServices.length,
        services: combinedServices.map((s) => ({ id: s._id, name: s.name }))
      });
      if (reviewsRes?.data) {
        setProviderReviews(Array.isArray(reviewsRes.data) ? reviewsRes.data : []);
      }
    } catch (err) {
      setError(err.message || 'Unable to load provider details');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return <LoadingScreen message="Loading provider profile..." />;
  }

  if (error || !provider) {
    return (
      <View style={styles.container}>
        <Header title="Provider Details" showBack onBack={() => navigation.goBack()} />
        <ErrorView
          message={error || 'This service provider profile is not available.'}
          onRetry={fetchDetail}
        />
      </View>
    );
  }

  const businessName = provider.businessName || provider.user?.name || 'Service Provider';
  const locationText = [provider.businessAddress?.city, provider.businessAddress?.state]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.container}>
      <Header
        title={businessName}
        subtitle="Verified Service Partner"
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Summary Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatarLarge}>
              <Ionicons name="business" size={36} color={colors.primary} />
            </View>

            <View style={styles.heroDetails}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {businessName}
                </Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>

              <Badge label="Verified Provider" variant="success" size="sm" style={styles.verifiedBadge} />

              {locationText ? (
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={14} color={colors.slate500} />
                  <Text style={styles.locText}>{locationText}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <View style={styles.statIconRow}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.statValue}>
                  {formatRating(provider.rating, 'New')}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {formatReviewCount(provider.reviewCount, provider.rating)
                  ? `${formatReviewCount(provider.reviewCount, provider.rating)} Reviews`
                  : 'No Reviews Yet'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <View style={styles.statIconRow}>
                <Ionicons name="ribbon-outline" size={16} color={colors.primary} />
                <Text style={styles.statValue}>
                  {formatExperience(provider.experienceYears, 1)}+ Yrs
                </Text>
              </View>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          </View>
        </Card>

        {/* Bio / About */}
        {provider.bio ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About the Provider</Text>
            <Text style={styles.bodyText}>{provider.bio}</Text>
          </Card>
        ) : null}

        {/* Categories / Specialties */}
        {Array.isArray(provider.categories || provider.serviceCategories) &&
          (provider.categories || provider.serviceCategories).length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Service Categories & Specialties</Text>
            <View style={styles.categoriesWrap}>
              {(provider.categories || provider.serviceCategories).map((c, idx) => (
                <Badge
                  key={c?._id || idx}
                  label={typeof c === 'object' ? c.name : c}
                  variant="primary"
                  size="md"
                  style={styles.categoryBadge}
                />
              ))}
            </View>
          </Card>
        )}

        {/* Services Offered by Provider */}
        {Array.isArray(provider.services) && provider.services.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={{ gap: spacing.sm }}>
              {provider.services.map((srv) => {
                const isSelected = targetServiceId && String(srv._id) === String(targetServiceId);
                return (
                  <View
                    key={srv._id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                      paddingHorizontal: isSelected ? spacing.sm : 0,
                      backgroundColor: isSelected ? '#F5F3FF' : 'transparent',
                      borderRadius: isSelected ? borderRadius.sm : 0,
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: isSelected ? '#DDD6FE' : 'transparent',
                      borderBottomWidth: isSelected ? 1 : 1,
                      borderBottomColor: isSelected ? '#DDD6FE' : colors.slate100
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ ...typography.bodyMedium, fontWeight: '700', color: colors.slate900 }}>
                          {srv.name}
                        </Text>
                        {isSelected && (
                          <Badge label="Selected" variant="primary" size="sm" />
                        )}
                      </View>
                      <Text style={{ ...typography.caption, color: colors.slate500 }}>
                        ₹{Number(srv.basePrice || srv.price || 0).toLocaleString('en-IN')} • {srv.estimatedDurationMinutes || 60} mins
                      </Text>
                    </View>
                    <Button
                      title="Book"
                      size="sm"
                      onPress={() =>
                        navigation.navigate('RequestService', {
                          providerId: provider._id,
                          provider,
                          serviceId: srv._id,
                          service: srv
                        })
                      }
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Customer Reviews Section */}
        <Card style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={styles.sectionTitle}>Customer Reviews & Ratings</Text>
            {providerReviews.length > 0 && (
              <Badge
                label={`${formatRating(provider.rating, '0.0')} ★ (${providerReviews.length})`}
                variant="primary"
                size="sm"
              />
            )}
          </View>

          {providerReviews.length === 0 ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.slate400} style={{ marginBottom: 6 }} />
              <Text style={{ ...typography.bodyMedium, color: colors.slate500, fontWeight: '500' }}>
                No reviews yet
              </Text>
              <Text style={{ ...typography.caption, color: colors.slate400, marginTop: 2 }}>
                Be the first to hire and review this service provider!
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {providerReviews.map((rev) => (
                <View
                  key={rev._id}
                  style={{
                    backgroundColor: colors.slate50 || '#F8FAFC',
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.slate200 || '#E2E8F0'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ ...typography.bodySmall, fontWeight: '700', color: colors.slate900 }}>
                      {rev.customer?.user?.name || 'Customer'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= rev.rating ? 'star' : 'star-outline'}
                          size={12}
                          color={star <= rev.rating ? '#F59E0B' : '#9CA3AF'}
                        />
                      ))}
                    </View>
                  </View>

                  {rev.service?.name && (
                    <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: 4 }}>
                      Service: {rev.service.name}
                    </Text>
                  )}

                  {rev.comment ? (
                    <Text style={{ ...typography.bodySmall, color: colors.slate700, lineHeight: 18 }}>
                      {rev.comment}
                    </Text>
                  ) : null}

                  <Text style={{ ...typography.caption, color: colors.slate400, marginTop: 6, fontSize: 10 }}>
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Verification & Trust Banner */}
        <Card style={styles.trustCard}>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={28} color={colors.success} />
            <View style={styles.trustTextCol}>
              <Text style={styles.trustTitle}>Vetted & Background Checked</Text>
              <Text style={styles.trustDesc}>
                This provider's business credentials and identity have been verified by our platform administrators.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Request Service with this Provider"
          onPress={() => {
            const hasServices = Array.isArray(provider.services) && provider.services.length > 0;
            // Prefer the targeted service from route navigation if present
            const matchedTargetService = targetServiceId && hasServices
              ? provider.services.find((s) => String(s._id) === String(targetServiceId))
              : null;
            // Only auto-select if target service was matched or if there is exactly 1 service; otherwise leave undefined
            const preselectedService = matchedTargetService || (hasServices && provider.services.length === 1 ? provider.services[0] : undefined);
            navigation.navigate('RequestService', {
              providerId: provider._id,
              provider,
              serviceId: preselectedService?._id,
              service: preselectedService
            });
          }}
          style={styles.actionBtn}
          textStyle={styles.actionBtnText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100
  },
  heroCard: {
    marginBottom: spacing.lg
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg
  },
  heroDetails: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  nameText: {
    ...typography.titleMedium,
    color: colors.slate900,
    flexShrink: 1
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  locText: {
    ...typography.bodySmall,
    color: colors.slate500
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center'
  },
  statCol: {
    flex: 1,
    alignItems: 'center'
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  statValue: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  statLabel: {
    ...typography.caption,
    color: colors.slate500
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border
  },
  sectionCard: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: spacing.md
  },
  bodyText: {
    ...typography.bodyMedium,
    color: colors.slate700,
    lineHeight: 22
  },
  categoriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  categoryBadge: {
    marginBottom: spacing.xs
  },
  trustCard: {
    backgroundColor: colors.successSubtle,
    borderColor: '#A7F3D0',
    marginBottom: spacing.lg
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  trustTextCol: {
    flex: 1
  },
  trustTitle: {
    ...typography.titleSmall,
    color: '#065F46',
    marginBottom: 2
  },
  trustDesc: {
    ...typography.bodySmall,
    color: '#047857',
    lineHeight: 18
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background, // Dark screen background '#0B0B0E'
    borderTopWidth: 1,
    borderTopColor: colors.border, // Dark card border '#252136'
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadows.elevated
  },
  actionBtn: {
    width: '100%',
    backgroundColor: colors.primary, // Mendroo purple '#7C3AED'
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 2
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16
  }
});

