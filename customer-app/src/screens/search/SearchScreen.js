import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { serviceApi, providerApi, categoryApi } from '../../services/api';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

const FILTER_PILLS = [
  { id: 'near_me', label: 'Near me >' },
  { id: 'category', label: 'Category >' },
  { id: 'rating', label: 'Rating 4+' },
  { id: 'price', label: 'Price' },
  { id: 'available', label: 'Available' }
];

const INITIAL_RECENT_SEARCHES = ['AC repair', 'Electrician'];

const POPULAR_GRID_ITEMS = [
  { id: 'electrician', label: 'Electrician', icon: 'flash-outline' },
  { id: 'mechanic', label: 'Mechanic', icon: 'construct-outline' },
  { id: 'plumber', label: 'Plumber', icon: 'water-outline' },
  { id: 'ac_service', label: 'AC Service', icon: 'snow-outline' }
];

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('near_me');
  const [recentSearches, setRecentSearches] = useState(INITIAL_RECENT_SEARCHES);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProviders = useCallback(async (queryText = '') => {
    try {
      const params = {};
      if (queryText.trim()) {
        params.search = queryText.trim();
      }
      const res = await providerApi.getAll(params);
      const list = res?.data || [];
      setProviders(list);
    } catch (err) {
      // Fallback empty
      setProviders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviders(searchQuery);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() && !recentSearches.includes(searchQuery.trim())) {
      setRecentSearches([searchQuery.trim(), ...recentSearches.slice(0, 4)]);
    }
    fetchProviders(searchQuery);
  };

  const handleRemoveRecent = (itemToRemove) => {
    setRecentSearches(recentSearches.filter((item) => item !== itemToRemove));
  };

  const handleClearAllRecent = () => {
    setRecentSearches([]);
  };

  const handleSelectRecent = (term) => {
    setSearchQuery(term);
    fetchProviders(term);
  };

  const renderProviderCard = ({ item }) => {
    const name = item.businessName || item.user?.name || 'Verified Professional';
    const category = item.categories?.[0]?.name || item.specialization || 'Home Services';
    const rating = item.rating?.average ? item.rating.average.toFixed(1) : '4.8';
    const totalJobs = item.stats?.completedJobs || item.completedBookings || 12;
    const distance = item.distance ? `${item.distance}km` : '1.4km';
    const price = item.pricing?.basePrice || item.hourlyRate || 499;

    return (
      <TouchableOpacity
        style={styles.providerCard}
        onPress={() => navigation.navigate('ProviderDetail', { providerId: item._id })}
        activeOpacity={0.7}
      >
        {/* Avatar / Photo */}
        <View style={styles.providerAvatarContainer}>
          <Image
            source={{
              uri:
                item.avatar ||
                item.profilePicture ||
                `https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80`
            }}
            style={styles.providerAvatar}
          />
        </View>

        {/* Info Col */}
        <View style={styles.providerInfoCol}>
          <View style={styles.providerNameRow}>
            <Text style={styles.providerName} numberOfLines={1}>
              {name}
            </Text>
            <Ionicons name="checkmark-circle" size={14} color="#7C3AED" style={{ marginLeft: 4 }} />
          </View>
          <Text style={styles.providerCategory}>{category}</Text>

          <View style={styles.providerMetricsRow}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
            <Text style={styles.metricDot}>•</Text>
            <Text style={styles.metricText}>{totalJobs}+ jobs</Text>
          </View>

          <View style={styles.availabilityRow}>
            <Ionicons name="location-outline" size={12} color="#9CA3AF" />
            <Text style={styles.distanceText}>{distance}</Text>
            <Text style={styles.metricDot}>•</Text>
            <Text style={styles.availableNowBadgeText}>Available today</Text>
          </View>
        </View>

        {/* Price & Action */}
        <View style={styles.providerRightCol}>
          <Text style={styles.startsAtText}>Starts at</Text>
          <Text style={styles.providerPrice}>₹{price}</Text>
          <Ionicons name="chevron-forward" size={18} color="#6B7280" style={{ marginTop: 12, alignSelf: 'flex-end' }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Scrollable Container with Search Header */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Title: Find a Service matching Figma hierarchy */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Find</Text>
          <Text style={styles.mainTitlePurple}>a</Text>
          <Text style={styles.mainTitle}>Service</Text>
        </View>

        {/* Search Bar with filter toggle icon */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="What service do you need?"
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color="#71717A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.filterIconButton} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={18} color="#A78BFA" />
          </TouchableOpacity>
        </View>

        {/* Filter Pills Horizontal Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {FILTER_PILLS.map((pill) => {
            const isSelected = activeFilter === pill.id;
            return (
              <TouchableOpacity
                key={pill.id}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setActiveFilter(pill.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent searches</Text>
              <TouchableOpacity onPress={handleClearAllRecent} activeOpacity={0.7}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentTagsRow}>
              {recentSearches.map((term) => (
                <View key={term} style={styles.recentTag}>
                  <TouchableOpacity onPress={() => handleSelectRecent(term)} activeOpacity={0.7}>
                    <Text style={styles.recentTagText}>{term}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveRecent(term)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Popular near you Grid (4 category cards) */}
        <View style={styles.popularSection}>
          <Text style={styles.sectionTitle}>Popular near you</Text>
          <View style={styles.popularGrid}>
            {POPULAR_GRID_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.categoryCard}
                onPress={() => {
                  setSearchQuery(item.label);
                  fetchProviders(item.label);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconCircle}>
                  <Ionicons name={item.icon} size={20} color="#A78BFA" />
                </View>
                <Text style={styles.categoryLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recommended Professionals Section */}
        <View style={styles.recommendedSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recommended professionals</Text>
            <Text style={styles.resultsCountText}>{providers.length || 16} results</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#7C3AED" style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={providers}
              keyExtractor={(item) => item._id}
              renderItem={renderProviderCard}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={40} color="#36314D" />
                  <Text style={styles.emptyText}>No verified professionals found</Text>
                </View>
              }
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  titleSection: {
    marginTop: 12,
    marginBottom: 16
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30
  },
  mainTitlePurple: {
    fontSize: 26,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: -0.5,
    lineHeight: 30
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 8
  },
  filterIconButton: {
    padding: 6,
    marginLeft: 6
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1A1726',
    borderWidth: 1,
    borderColor: '#262238'
  },
  filterPillActive: {
    backgroundColor: '#2E1065',
    borderColor: '#7C3AED'
  },
  filterPillText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  filterPillTextActive: {
    color: '#DDD6FE',
    fontWeight: '600'
  },
  recentSection: {
    marginBottom: 20
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  clearText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600'
  },
  resultsCountText: {
    fontSize: 12,
    color: '#71717A'
  },
  recentTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  recentTagText: {
    fontSize: 12,
    color: '#E2E8F0'
  },
  popularSection: {
    marginBottom: 22
  },
  popularGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  categoryCard: {
    width: '23%',
    backgroundColor: '#161420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252136',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  categoryLabel: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '500',
    textAlign: 'center'
  },
  recommendedSection: {
    marginBottom: 20
  },
  providerCard: {
    flexDirection: 'row',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center'
  },
  providerAvatarContainer: {
    marginRight: 12
  },
  providerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#262238'
  },
  providerInfoCol: {
    flex: 1
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  providerCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 4
  },
  providerMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B'
  },
  metricDot: {
    fontSize: 11,
    color: '#6B7280',
    marginHorizontal: 4
  },
  metricText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  distanceText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 2
  },
  availableNowBadgeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600'
  },
  providerRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8
  },
  startsAtText: {
    fontSize: 10,
    color: '#71717A'
  },
  providerPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32
  },
  emptyText: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 8
  }
});
