import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerApi, tagApi } from '../../services/api';
import { Header, Input, Card, Badge, EmptyState } from '../../components/common';
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
    serviceName: initialServiceName,
    tagId: initialTagId
  } = route?.params || {};

  const activeCategory =
    initialCategoryId ||
    (typeof initialCategory === 'object' ? initialCategory?._id : initialCategory);
  const activeService =
    initialServiceId ||
    (typeof initialService === 'object' ? initialService?._id : initialService);

  // Category & tags state
  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState(initialTagId || 'ALL');
  const [categoryName, setCategoryName] = useState(initialCategoryName || '');
  const [loadingTags, setLoadingTags] = useState(false);

  // Providers state
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switchingTag, setSwitchingTag] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search state with debouncing
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef(null);

  // Handle search text changes with 250ms debounce
  const handleSearchChange = (text) => {
    setSearchText(text);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(text.trim());
    }, 250);
  };

  const handleClearSearch = () => {
    setSearchText('');
    setDebouncedSearch('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // 1. Fetch tags for the active category
  const fetchCategoryTags = useCallback(async () => {
    if (!activeCategory) return;
    setLoadingTags(true);
    try {
      const res = await tagApi.getCategoryTags(activeCategory);
      if (res?.success) {
        // Safe extraction whether response format is:
        // - res.data = [tags]
        // - res.data.tags = [tags]
        // - res.tags = [tags]
        let extractedTags = [];
        if (Array.isArray(res.data)) {
          extractedTags = res.data;
        } else if (Array.isArray(res.data?.tags)) {
          extractedTags = res.data.tags;
        } else if (Array.isArray(res.tags)) {
          extractedTags = res.tags;
        }

        const catObj = res.category || res.data?.category;
        if (catObj?.name && !categoryName) {
          setCategoryName(catObj.name);
        }

        setTags(extractedTags);
      }
    } catch (err) {
      console.warn('[ProvidersScreen] Error loading category tags:', err.message);
    } finally {
      setLoadingTags(false);
    }
  }, [activeCategory, categoryName]);

  useEffect(() => {
    fetchCategoryTags();
  }, [fetchCategoryTags]);

  // 2. Fetch Providers (filtered by active category + tag + debounced search)
  const fetchProviders = useCallback(async (isTagSwitch = false) => {
    try {
      setError(null);
      if (isTagSwitch) {
        setSwitchingTag(true);
      }

      let list = [];
      if (activeCategory) {
        const params = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (selectedTagId && selectedTagId !== 'ALL') {
          params.tagId = selectedTagId;
        }

        const res = await tagApi.getProvidersByCategoryAndTag(activeCategory, params);
        if (res?.success) {
          if (Array.isArray(res.data?.providers)) {
            list = res.data.providers;
          } else if (Array.isArray(res.providers)) {
            list = res.providers;
          } else if (Array.isArray(res.data)) {
            list = res.data;
          }
        }
      } else {
        const params = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (activeService) params.service = activeService;

        const res = await providerApi.getAll(params);
        list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      }

      setProviders(list);
    } catch (err) {
      setError(err.userMessage || err.message || 'Unable to load verified providers');
    } finally {
      setLoading(false);
      setSwitchingTag(false);
      setRefreshing(false);
    }
  }, [activeCategory, activeService, selectedTagId, debouncedSearch]);

  useEffect(() => {
    fetchProviders(false);
  }, [fetchProviders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCategoryTags();
    fetchProviders(false);
  };

  const handleSelectTag = (tagId) => {
    if (selectedTagId === tagId) return;
    setSelectedTagId(tagId);
  };

  // Selected tag object helper
  const selectedTagObj = useMemo(() => {
    if (!selectedTagId || selectedTagId === 'ALL') return null;
    return tags.find((t) => String(t._id) === String(selectedTagId));
  }, [tags, selectedTagId]);

  const titleText = categoryName
    ? `${categoryName} Experts`
    : initialServiceName
    ? `${initialServiceName} Specialists`
    : 'Find Verified Providers';

  const subtitleText = selectedTagObj
    ? `Filtered by: ${selectedTagObj.name}`
    : categoryName
    ? 'Verified professionals in this category'
    : 'Trusted local service experts';

  // Render individual provider card
  const renderProviderCard = ({ item }) => {
    const businessName = item.businessName || item.user?.name || 'Verified Provider';
    const avatarUri = item.avatar || item.user?.avatar;

    // Build categories or specialization text without generic "All Services"
    const cats = item.categories || item.serviceCategories;
    let categoriesText = '';
    if (Array.isArray(cats) && cats.length > 0) {
      categoriesText = cats
        .map((c) => (typeof c === 'object' ? c.name : c))
        .filter((name) => name && name.toLowerCase() !== 'all services')
        .join(', ');
    }
    if (!categoriesText) {
      categoriesText =
        item.specialization && item.specialization.toLowerCase() !== 'all services'
          ? item.specialization
          : categoryName
          ? `${categoryName} Specialist`
          : 'Verified Professional';
    }

    // Determine displayed price: if selected tag has custom rate for this provider, show that
    let displayPrice = item.servicePrice || null;
    let priceLabel = item.pricingType === 'hourly' ? 'Rate: ' : 'Fixed: ';

    if (!displayPrice && selectedTagObj && Array.isArray(item.serviceTags)) {
      const matchedTag = item.serviceTags.find(
        (st) => String(st.tag?._id || st.tag) === String(selectedTagObj._id)
      );
      if (matchedTag && matchedTag.basePrice) {
        displayPrice = matchedTag.basePrice;
        priceLabel = matchedTag.pricingType === 'hourly' ? 'Rate: ' : 'Fixed: ';
      }
    }
    if (!displayPrice) {
      displayPrice = item.pricing?.basePrice ?? item.basePrice ?? item.startingPrice;
      priceLabel = 'Starts at ';
    }

    // Provider verified active tags
    const activeTagsList = Array.isArray(item.activeTags) && item.activeTags.length > 0
      ? item.activeTags
      : Array.isArray(item.serviceTags)
      ? item.serviceTags
          .filter((st) => st.isActive !== false && st.approvalStatus === 'approved')
          .map((st) => ({
            _id: st.tag?._id || st.tag,
            name: st.tag?.name || st.name
          }))
          .filter((t) => Boolean(t.name))
      : [];

    return (
      <Card
        style={styles.card}
        onPress={() =>
          navigation.navigate('ProviderDetail', {
            providerId: item._id,
            selectedServiceId: activeService || undefined,
            tagId: selectedTagObj?._id,
            tagName: selectedTagObj?.name,
            categoryId: activeCategory,
            categoryName
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
              <Ionicons name="checkmark-circle" size={17} color="#10B981" />
            </View>

            <Text style={styles.categoriesText} numberOfLines={1}>
              {categoriesText}
            </Text>

            {item.bio ? (
              <Text style={styles.bioText} numberOfLines={2}>
                {item.bio}
              </Text>
            ) : null}

            {/* Provider Dynamic Tag Pills */}
            {activeTagsList.length > 0 && (
              <View style={styles.tagPillsRow}>
                {activeTagsList.slice(0, 3).map((tagItem, idx) => {
                  const isCurrentTag = selectedTagObj && (
                    String(tagItem._id) === String(selectedTagObj._id) ||
                    tagItem.name === selectedTagObj.name
                  );
                  return (
                    <View
                      key={(tagItem._id || tagItem.name) + idx}
                      style={[styles.tagPill, isCurrentTag && styles.tagPillActive]}
                    >
                      <Text
                        style={[
                          styles.tagPillText,
                          isCurrentTag && styles.tagPillTextActive
                        ]}
                        numberOfLines={1}
                      >
                        {tagItem.name}
                      </Text>
                    </View>
                  );
                })}
                {activeTagsList.length > 3 && (
                  <Text style={styles.tagPillMore}>+{activeTagsList.length - 3}</Text>
                )}
              </View>
            )}

            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingText}>
                  {formatRating(item.rating, 'New')}
                </Text>
                {formatReviewCount(item.reviewCount, item.rating) ? (
                  <Text style={styles.reviewCount}>
                    ({formatReviewCount(item.reviewCount, item.rating)})
                  </Text>
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
                {displayPrice != null && displayPrice > 0 ? (
                  <>
                    <Text style={styles.startingAtLabel}>{priceLabel}</Text>
                    <Text style={styles.priceVal}>₹{displayPrice}</Text>
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
                    selectedServiceId: activeService || undefined,
                    tagId: selectedTagObj?._id,
                    tagName: selectedTagObj?.name,
                    categoryId: activeCategory,
                    categoryName
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.viewProfileText}>Book Now</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. Category Header (Pinned Top) */}
      <Header
        title={titleText}
        subtitle={subtitleText}
        showBack={navigation?.canGoBack?.() || false}
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      {/* 2. Provider Search Bar (Pinned Directly Below Header) */}
      <View style={styles.searchSection}>
        <Input
          placeholder="Search by provider name or skill..."
          value={searchText}
          onChangeText={handleSearchChange}
          leftIcon="search-outline"
          rightIcon={searchText ? 'close-circle' : null}
          onRightIconPress={handleClearSearch}
          containerStyle={styles.searchContainer}
        />
      </View>

      {/* 3. Category-Specific Service Tags (Pinned Directly Below Search Bar) */}
      <View style={styles.tagChipsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagChipsScroll}
        >
          {/* Always Show "All" as First Chip */}
          <TouchableOpacity
            style={[
              styles.tagChip,
              selectedTagId === 'ALL' && styles.tagChipSelected
            ]}
            onPress={() => handleSelectTag('ALL')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tagChipText,
                selectedTagId === 'ALL' && styles.tagChipTextSelected
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {/* Dynamic Service Tag Chips */}
          {tags.map((tag) => {
            const isSelected = String(tag._id) === String(selectedTagId);
            return (
              <TouchableOpacity
                key={tag._id}
                style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                onPress={() => handleSelectTag(tag._id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    isSelected && styles.tagChipTextSelected
                  ]}
                >
                  {tag.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Provider List & Available Professionals Header */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding verified providers...</Text>
        </View>
      ) : switchingTag ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primaryLight} />
          <Text style={styles.loadingText}>
            Loading {selectedTagObj ? selectedTagObj.name : 'providers'}...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Could not load providers</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchProviders(false)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={providers}
          keyExtractor={(item) => item._id}
          renderItem={renderProviderCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xxl }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            providers.length > 0 ? (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Available Professionals</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{providers.length}</Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={
                selectedTagObj
                  ? `No Providers for "${selectedTagObj.name}"`
                  : debouncedSearch
                  ? 'No Matching Providers'
                  : 'No Providers Available'
              }
              description={
                selectedTagObj
                  ? `No verified professionals are currently offering "${selectedTagObj.name}" in this category. Try choosing "All" or another service tag.`
                  : debouncedSearch
                  ? `No verified providers match "${debouncedSearch}". Try searching by another name or skill.`
                  : `No verified providers are currently active in ${categoryName || 'this category'}. Please check back soon.`
              }
              actionTitle={
                selectedTagObj
                  ? `Show All ${categoryName ? categoryName + ' ' : ''}Providers`
                  : debouncedSearch
                  ? 'Clear Search'
                  : 'Explore Other Categories'
              }
              onAction={
                selectedTagObj
                  ? () => setSelectedTagId('ALL')
                  : debouncedSearch
                  ? handleClearSearch
                  : () => navigation.navigate('SearchTab')
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
    backgroundColor: '#0F0E16'
  },
  searchSection: {
    backgroundColor: '#161420',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#221E33'
  },
  searchContainer: {
    marginBottom: 0
  },
  tagChipsSection: {
    backgroundColor: '#13111C',
    borderBottomWidth: 1,
    borderBottomColor: '#221E33',
    paddingVertical: 10
  },
  tagChipsScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1C1929',
    borderWidth: 1,
    borderColor: '#2E2845'
  },
  tagChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6'
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF'
  },
  tagChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xs
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.2
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)'
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: '#9CA3AF'
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12
  },
  errorSub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16
  },
  retryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  listContent: {
    padding: spacing.md
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
    marginBottom: spacing.xs,
    lineHeight: 18
  },
  tagPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
    marginTop: 2
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#201C30',
    borderWidth: 1,
    borderColor: '#2D2845'
  },
  tagPillActive: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.25)'
  },
  tagPillText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '500'
  },
  tagPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  tagPillMore: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600'
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
