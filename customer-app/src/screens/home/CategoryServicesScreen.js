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
import { spacing, typography } from '../../theme';
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
        {item.duration ? (
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={14} color={colors.slate400} />
            <Text style={styles.durationText}>{item.duration} mins</Text>
          </View>
        ) : null}
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
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

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
              actionTitle="Explore All Services"
              onAction={() => navigation.navigate('ServicesTab')}
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
  }
});
