import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { serviceApi } from '../../services/api';
import { Header, Card, Badge, Button, LoadingScreen, ErrorView } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius, shadows } from '../../theme';
import { PRICING_TYPES, PRICING_LABELS } from '../../constants';

export default function ServiceDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { serviceId } = route.params || {};

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!serviceId) return;
    try {
      setError(null);
      const res = await serviceApi.getById(serviceId);
      setService(res.data);
    } catch (err) {
      setError(err.message || 'Unable to load service details');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return <LoadingScreen message="Loading service information..." />;
  }

  if (error || !service) {
    return (
      <View style={styles.container}>
        <Header title="Service Details" showBack onBack={() => navigation.goBack()} />
        <ErrorView
          message={error || 'This service is no longer available.'}
          onRetry={fetchDetail}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={service.name}
        subtitle={service.category?.name}
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pricing & Summary Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <Badge
              label={service.category?.name || 'Category'}
              variant="primary"
              size="md"
            />
            <Badge
              label={PRICING_LABELS[service.pricingType] || service.pricingType}
              variant="slate"
              size="md"
            />
          </View>

          <Text style={styles.title}>{service.name}</Text>

          <View style={styles.metaRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Base Price</Text>
              <Text style={styles.priceValue}>
                ₹{service.basePrice?.toLocaleString('en-IN') || 0}
                {service.pricingType === PRICING_TYPES.HOURLY && (
                  <Text style={styles.unitText}> / hr</Text>
                )}
              </Text>
            </View>

            {service.duration ? (
              <View style={styles.durationContainer}>
                <Text style={styles.durationLabel}>Duration</Text>
                <View style={styles.durationValueRow}>
                  <Ionicons name="time-outline" size={16} color={colors.slate700} />
                  <Text style={styles.durationValue}>{service.duration} mins</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Card>

        {/* Description */}
        {service.description ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About this Service</Text>
            <Text style={styles.bodyText}>{service.description}</Text>
          </Card>
        ) : null}

        {/* Inclusions */}
        {Array.isArray(service.inclusions) && service.inclusions.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            {service.inclusions.map((item, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Exclusions */}
        {Array.isArray(service.exclusions) && service.exclusions.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>What's Not Included</Text>
            {service.exclusions.map((item, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Terms */}
        {Array.isArray(service.terms) && service.terms.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Important Notes & Terms</Text>
            {service.terms.map((item, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <Ionicons name="information-circle" size={18} color={colors.slate400} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Floating Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.bottomPriceCol}>
          <Text style={styles.bottomPriceLabel}>Total Starting At</Text>
          <Text style={styles.bottomPriceValue}>
            ₹{service.basePrice?.toLocaleString('en-IN') || 0}
          </Text>
        </View>
        <Button
          title="Book / Request Service"
          onPress={() =>
            navigation.navigate('RequestService', {
              serviceId: service._id,
              service
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
  heroBadgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  title: {
    ...typography.titleLarge,
    color: colors.slate900,
    marginBottom: spacing.lg
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.slate50,
    borderRadius: borderRadius.md,
    padding: spacing.md
  },
  priceContainer: {},
  priceLabel: {
    ...typography.caption,
    color: colors.slate500,
    marginBottom: 2
  },
  priceValue: {
    ...typography.titleMedium,
    color: colors.primaryDark,
    fontWeight: '700'
  },
  unitText: {
    fontSize: 14,
    color: colors.slate500,
    fontWeight: '500'
  },
  durationContainer: {
    alignItems: 'flex-end'
  },
  durationLabel: {
    ...typography.caption,
    color: colors.slate500,
    marginBottom: 2
  },
  durationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  durationValue: {
    ...typography.bodyMedium,
    color: colors.slate800,
    fontWeight: '600'
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
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  bulletText: {
    ...typography.bodyMedium,
    color: colors.slate700,
    flex: 1
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.elevated
  },
  bottomPriceCol: {
    marginRight: spacing.md
  },
  bottomPriceLabel: {
    ...typography.caption,
    color: colors.slate500
  },
  bottomPriceValue: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  actionBtn: {
    flex: 1
  }
});
