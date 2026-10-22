import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerApi } from '../../services/api';
import { Header, Input, Card, Badge, LoadingScreen, ErrorView, EmptyState } from '../../components/common';
import { formatRating, formatReviewCount, formatExperience } from '../../utils/formatters';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProvidersScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const {
    category: initialCategory,
    categoryId: initialCategoryId,
    categoryName: initialCategoryName,
    service: initialService,
    serviceId: initialServiceId,
    serviceName: initialServiceName
  } = route?.params || {};

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const activeCategory = initialCategoryId || initialCategory;
  const activeService = initialServiceId || initialService;
  const titleText = initialServiceName
    ? `${initialServiceName} Specialists`
    : initialCategoryName
    ? `${initialCategoryName} Specialists`
    : 'Find Verified Providers';

  const subtitleText = initialServiceName
    ? 'Verified providers offering this service'
    : initialCategoryName
    ? 'Verified professionals in this category'
    : 'Trusted local service experts';

  const fetchProviders = useCallback(async () => {
    try {
      setError(null);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (activeCategory) params.category = activeCategory;
      if (activeService) params.service = activeService;

      const res = await providerApi.getAll(params);
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setProviders(list);
    } catch (err) {
      setError(err.message || 'Unable to load verified providers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeCategory, activeService]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  const renderProviderCard = ({ item }) => {
    const businessName = item.businessName || item.user?.name || 'Verified Provider';
    const cats = item.categories || item.serviceCategories;
    const categoriesText =
      Array.isArray(cats) && cats.length > 0
        ? cats.map((c) => (typeof c === 'object' ? c.name : c)).join(', ')
        : item.specialization || 'All Services';

    const avatarUri = item.avatar || item.user?.avatar;
    const startingPrice = item.pricing?.basePrice ?? item.basePrice ?? item.startingPrice;

    return (
      <Card
        style={styles.card}
        onPress={() =>
          navigation.navigate('ProviderDetail', {
            providerId: item._id,
            selectedServiceId: activeService || undefined
          })
        }
      >
        <View style={styles.cardRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="business" size={26} color={colors.primary} />
            </View>
          )}

          <View style={styles.infoCol}>
            <View style={styles.headerRow}>
              <Text style={styles.businessName} numberOfLines={1}>
                {businessName}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
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
                  {formatRating(item.rating, 'New')}
                </Text>
                {formatReviewCount(item.reviewCount, item.rating) ? (
                  <Text style={styles.reviewCount}>({formatReviewCount(item.reviewCount, item.rating)})</Text>
                ) : null}
              </View>

              {formatExperience(item.experienceYears) ? (
                <Text style={styles.experienceText}>
                  • {formatExperience(item.experienceYears)} Yrs Exp
                </Text>
              ) : null}
            </View>

            {/* Price & Action Row */}
            <View style={styles.bottomActionRow}>
              <View style={styles.priceContainer}>
                {startingPrice != null && startingPrice > 0 ? (
                  <>
                    <Text style={styles.startingAtLabel}>Starts at </Text>
                    <Text style={styles.priceVal}>₹{startingPrice}</Text>
                  </>
                ) : (
                  <Text style={styles.ratesOnRequestText}>Standard Rates</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.viewProfileBtn}
                onPress={() =>
                  navigation.navigate('ProviderDetail', {
                    providerId: item._id,
                    selectedServiceId: activeService || undefined
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.viewProfileText}>View Profile</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  const hasFilter = Boolean(activeCategory || activeService);

  return (
    <View style={styles.container}>
      <Header
        title={titleText}
        subtitle={subtitleText}
        showBack={navigation?.canGoBack?.() || false}
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <View style={styles.searchSection}>
        <Input
          placeholder="Search by provider name or skill..."
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
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xxl }]}
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
              title="No Providers Available"
              description={
                search
                  ? `No verified providers match "${search}". Try searching for something else.`
                  : hasFilter
                  ? 'No verified providers are currently active in this category or service. Please explore our other active categories or check back soon.'
                  : 'There are currently no verified providers available.'
              }
              actionTitle={search ? 'Clear Search' : hasFilter ? 'Explore All Categories' : undefined}
              onAction={search ? () => setSearch('') : hasFilter ? () => navigation.navigate('SearchTab') : undefined}
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
    backgroundColor: '#0F0E16'
  },
  searchSection: {
    backgroundColor: '#161420',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#252136'
  },
  searchContainer: {
    marginBottom: 0
  },
  listContent: {
    padding: spacing.lg
  },
  card: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    color: '#FFFFFF',
    fontWeight: '700',
    flexShrink: 1
  },
  categoriesText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600',
    marginBottom: 4
  },
  bioText: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginBottom: spacing.sm,
    lineHeight: 18
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#272010',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B'
  },
  reviewCount: {
    fontSize: 11,
    color: '#FCD34D'
  },
  experienceText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#252136',
    marginTop: 2
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  startingAtLabel: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  priceVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  ratesOnRequestText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic'
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm
  },
  viewProfileText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  }
});
