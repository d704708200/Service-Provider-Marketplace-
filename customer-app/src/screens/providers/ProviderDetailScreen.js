import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView } from '../../components/common';
import { formatRating, formatReviewCount, formatExperience } from '../../utils/formatters';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../theme';

export default function ProviderDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { providerId } = route.params || {};

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!providerId) return;
    try {
      setError(null);
      const res = await providerApi.getById(providerId);
      setProvider(res.data);
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
          onPress={() =>
            navigation.navigate('RequestService', {
              providerId: provider._id,
              provider
            })
          }
          style={styles.actionBtn}
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
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    ...shadows.elevated
  },
  actionBtn: {
    width: '100%'
  }
});
