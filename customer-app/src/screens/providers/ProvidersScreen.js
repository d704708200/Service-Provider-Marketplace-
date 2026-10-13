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
import { providerApi } from '../../services/api';
import { Input, Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProvidersScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchProviders = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (search.trim()) params.search = search.trim();

      const res = await providerApi.getAll(params);
      setProviders(res.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load verified providers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  const renderProviderCard = ({ item }) => {
    const businessName = item.businessName || item.user?.name || 'Verified Provider';
    const categoriesText =
      Array.isArray(item.serviceCategories) && item.serviceCategories.length > 0
        ? item.serviceCategories.map((c) => (typeof c === 'object' ? c.name : c)).join(', ')
        : 'All Services';

    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('ProviderDetail', { providerId: item._id })}
      >
        <View style={styles.cardRow}>
          <View style={styles.avatar}>
            <Ionicons name="business" size={26} color={colors.primary} />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.headerRow}>
              <Text style={styles.businessName} numberOfLines={1}>
                {businessName}
              </Text>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            </View>

            <Text style={styles.categoriesText} numberOfLines={1}>
              {categoriesText}
            </Text>

            {item.bio ? (
              <Text style={styles.bioText} numberOfLines={2}>
                {item.bio}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>
                  {item.rating ? item.rating.toFixed(1) : 'New'}
                </Text>
                {item.reviewCount ? (
                  <Text style={styles.reviewCount}>({item.reviewCount})</Text>
                ) : null}
              </View>

              {item.experienceYears ? (
                <Text style={styles.experienceText}>
                  • {item.experienceYears} Years Experience
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header and Search */}
      <View style={[styles.headerSection, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Find Verified Providers</Text>
        <Input
          placeholder="Search by business name or service..."
          value={search}
          onChangeText={setSearch}
          leftIcon="search-outline"
          rightIcon={search ? 'close-circle' : null}
          onRightIconPress={() => setSearch('')}
          containerStyle={styles.searchContainer}
        />
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <LoadingScreen message="Finding verified providers..." />
      ) : error ? (
        <ErrorView message={error} onRetry={fetchProviders} />
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item._id}
          renderItem={renderProviderCard}
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
              icon="people-outline"
              title="No Providers Found"
              description={
                search
                  ? `No verified providers match "${search}". Try searching for something else.`
                  : 'There are currently no verified providers available.'
              }
              actionTitle={search ? 'Clear Search' : undefined}
              onAction={search ? () => setSearch('') : undefined}
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
  title: {
    ...typography.titleLarge,
    color: colors.slate900,
    marginBottom: spacing.xs
  },
  searchContainer: {
    marginBottom: 0
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl
  },
  card: {
    marginBottom: spacing.md
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  infoCol: {
    flex: 1
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  businessName: {
    ...typography.titleSmall,
    color: colors.slate900,
    flexShrink: 1
  },
  categoriesText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4
  },
  bioText: {
    ...typography.bodySmall,
    color: colors.slate600,
    marginBottom: spacing.sm
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
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
  reviewCount: {
    fontSize: 11,
    color: '#92400E'
  },
  experienceText: {
    ...typography.caption,
    color: colors.slate500
  }
});
