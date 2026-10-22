import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { serviceApi } from '../../services/api';
import { Header, Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';
import { PRICING_LABELS } from '../../constants';

export default function CategoryServicesScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { categoryId, categoryName, categoryDescription } = route.params || {};

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchServices = useCallback(async () => {
    if (!categoryId) return;
    try {
      setError(null);
      const res = await serviceApi.getAll({ category: categoryId });
      setServices(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load category services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const renderServiceItem = ({ item }) => (
    <Card
      style={styles.serviceCard}
      onPress={() => navigation.navigate('ServiceDetail', { serviceId: item._id })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.serviceName} numberOfLines={1}>
          {item.name}
        </Text>
        <Badge
          label={PRICING_LABELS[item.pricingType] || item.pricingType}
          variant="primary"
          size="sm"
        />
      </View>
      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.priceText}>
          ₹{item.basePrice?.toLocaleString('en-IN') || 0}
        </Text>
        <View style={styles.cardActionsRow}>
          {item.duration ? (
            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={14} color={colors.slate400} />
              <Text style={styles.durationText}>{item.duration} mins</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.findProvidersChip}
            onPress={() =>
              navigation.navigate('Providers', {
                serviceId: item._id,
                serviceName: item.name,
                categoryId: item.category?._id || item.category || categoryId,
                categoryName: categoryName
              })
            }
            activeOpacity={0.7}
          >
            <Text style={styles.findProvidersChipText}>View Providers</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header
        title={categoryName || 'Category Services'}
        subtitle={categoryDescription}
        showBack
        onBack={() => navigation.goBack()}
        rightIcon="people-outline"
        onRightIconPress={() =>
          navigation.navigate('Providers', {
            categoryId,
            categoryName
          })
        }
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      {/* Top Specialists Quick Action Banner */}
      {categoryId ? (
        <TouchableOpacity
          style={styles.specialistsBanner}
          onPress={() =>
            navigation.navigate('Providers', {
              categoryId,
              categoryName
            })
          }
          activeOpacity={0.8}
        >
          <View style={styles.specialistsBannerLeft}>
            <View style={styles.specialistsBannerIconCircle}>
              <Ionicons name="shield-checkmark" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.specialistsBannerTitle}>
                View {categoryName || 'Category'} Specialists
              </Text>
              <Text style={styles.specialistsBannerSubtitle}>
                See verified and active providers for this category
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
        </TouchableOpacity>
      ) : null}

      {loading && !refreshing ? (
        <LoadingScreen message="Loading services..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchServices} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          renderItem={renderServiceItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No Services in this Category"
              description="There are currently no active services listed under this category."
              actionTitle="View Category Providers"
              onAction={() =>
                navigation.navigate('Providers', {
                  categoryId,
                  categoryName
                })
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  serviceCard: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.slate900,
    flex: 1,
    marginRight: spacing.sm
  },
  description: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginBottom: spacing.md
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm
  },
  priceText: {
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  findProvidersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 2
  },
  findProvidersChipText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700'
  },
  specialistsBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  specialistsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  specialistsBannerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  specialistsBannerTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: '#5B21B6'
  },
  specialistsBannerSubtitle: {
    ...typography.caption,
    color: '#7C3AED',
    fontSize: 11
  }
});
