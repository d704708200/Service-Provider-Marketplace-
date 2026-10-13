import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { serviceApi, categoryApi } from '../../services/api';
import { Input, Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';
import { PRICING_TYPES, PRICING_LABELS } from '../../constants';

export default function ServicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPricingType, setSelectedPricingType] = useState(null);

  const fetchFilters = async () => {
    try {
      const res = await categoryApi.getAll();
      setCategories(res.data || []);
    } catch (err) {
      // Non-critical: continue without category pills
    }
  };

  const fetchServices = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (selectedPricingType) params.pricingType = selectedPricingType;

      const res = await serviceApi.getAll(params);
      setServices(res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load services catalog');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedPricingType]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setSelectedPricingType(null);
  };

  const hasActiveFilters = Boolean(search || selectedCategory || selectedPricingType);

  const renderServiceCard = ({ item }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('ServiceDetail', { serviceId: item._id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleCol}>
          <Text style={styles.serviceName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.categoryName}>
            {item.category?.name || 'General Service'}
          </Text>
        </View>
        <Badge
          label={PRICING_LABELS[item.pricingType] || item.pricingType}
          variant="primary"
          size="sm"
        />
      </View>

      {item.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.priceRow}>
          <Text style={styles.priceSymbol}>₹</Text>
          <Text style={styles.priceAmount}>
            {item.basePrice?.toLocaleString('en-IN') || 0}
          </Text>
          <Text style={styles.priceUnit}>
            {item.pricingType === PRICING_TYPES.HOURLY ? '/hr' : ''}
          </Text>
        </View>

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
      {/* Search & Header */}
      <View style={[styles.headerSection, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Services Catalog</Text>
        <Input
          placeholder="Search services (e.g. plumbing, clean)..."
          value={search}
          onChangeText={setSearch}
          leftIcon="search-outline"
          rightIcon={search ? 'close-circle' : null}
          onRightIconPress={() => setSearch('')}
          containerStyle={styles.searchInputContainer}
        />

        {/* Categories Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.chip, !selectedCategory && styles.activeChip]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.activeChipText]}>
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat._id}
              style={[styles.chip, selectedCategory === cat._id && styles.activeChip]}
              onPress={() =>
                setSelectedCategory(selectedCategory === cat._id ? null : cat._id)
              }
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCategory === cat._id && styles.activeChipText
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <LoadingScreen message="Searching services..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchServices} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item._id}
          renderItem={renderServiceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No Services Found"
              description={
                hasActiveFilters
                  ? 'No services match your active search or filters. Try adjusting your query.'
                  : 'There are currently no active services available in the catalog.'
              }
              actionTitle={hasActiveFilters ? 'Clear Filters' : undefined}
              onAction={hasActiveFilters ? clearFilters : undefined}
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
  headerSection: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: {
    ...typography.titleLarge,
    color: colors.slate900,
    marginBottom: spacing.xs
  },
  searchInputContainer: {
    marginBottom: spacing.xs
  },
  chipsScroll: {
    paddingVertical: spacing.xs,
    gap: spacing.xs
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.slate100,
    marginRight: spacing.xs
  },
  activeChip: {
    backgroundColor: colors.primary
  },
  chipText: {
    ...typography.caption,
    color: colors.slate700,
    fontWeight: '600'
  },
  activeChipText: {
    color: colors.white
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.sm
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.slate900,
    marginBottom: 2
  },
  categoryName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600'
  },
  desc: {
    ...typography.bodySmall,
    color: colors.slate600,
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  priceSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.slate900
  },
  priceAmount: {
    ...typography.titleSmall,
    color: colors.slate900,
    fontWeight: '700'
  },
  priceUnit: {
    ...typography.caption,
    color: colors.slate500,
    marginLeft: 2
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
