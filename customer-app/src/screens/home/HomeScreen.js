import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { categoryApi, serviceApi, providerApi, bannerApi } from '../../services/api';
import { formatRating } from '../../utils/formatters';
import colors from '../../theme/colors';

const DEFAULT_CATEGORY_ICONS = {
  electrician: 'flash-outline',
  mechanic: 'construct-outline',
  plumber: 'water-outline',
  'ac service': 'snow-outline',
  'ac repair': 'snow-outline',
  'electrical repair': 'flash-outline',
  'bike service': 'bicycle-outline',
  carpenter: 'hammer-outline',
  painter: 'color-palette-outline',
  cleaner: 'sparkles-outline',
  'pest control': 'shield-outline'
};

const resolveIconName = (icon, name) => {
  if (icon && typeof icon === 'string' && icon.trim()) {
    return icon.trim();
  }
  const cleanName = (name || '').toLowerCase().trim();
  if (DEFAULT_CATEGORY_ICONS[cleanName]) {
    return DEFAULT_CATEGORY_ICONS[cleanName];
  }
  for (const [key, val] of Object.entries(DEFAULT_CATEGORY_ICONS)) {
    if (cleanName.includes(key)) {
      return val;
    }
  }
  return 'grid-outline';
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    location,
    permissionStatus,
    isLoading: isLocationLoading,
    promptLocationFlow,
    fetchCurrentLocation
  } = useLocation();

  const [categories, setCategories] = useState([]);
  const [quickServices, setQuickServices] = useState([]);
  const [popularServices, setPopularServices] = useState([]);
  const [featuredServices, setFeaturedServices] = useState([]);
  const [topRatedProviders, setTopRatedProviders] = useState([]);
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [bannerConfig, setBannerConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Auto-prompt location on startup (once) or check existing permission
  useEffect(() => {
    promptLocationFlow(false);
  }, []);

  // Helper to extract an array safely from any standard API response envelope
  const extractArray = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.data)) return res.data.data;
    if (Array.isArray(res.data?.providers)) return res.data.providers;
    if (Array.isArray(res.data?.categories)) return res.data.categories;
    if (Array.isArray(res.data?.services)) return res.data.services;
    if (Array.isArray(res.providers)) return res.providers;
    if (Array.isArray(res.categories)) return res.categories;
    if (Array.isArray(res.services)) return res.services;
    return [];
  };

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const nearbyParams = { limit: 6 };
      if (location?.city) {
        nearbyParams.city = location.city;
      }
      if (location?.latitude && location?.longitude) {
        nearbyParams.latitude = location.latitude;
        nearbyParams.longitude = location.longitude;
      }

      const [allCatRes, quickCatRes, popCatRes, servRes, topProvRes, allProvRes, bannerRes] = await Promise.all([
        categoryApi.getAll().catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] all categories fetch failed:', e?.message);
          return { data: [] };
        }),
        categoryApi.getAll({ quickServices: true }).catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] quick services fetch failed:', e?.message);
          return { data: [] };
        }),
        categoryApi.getAll({ popularServices: true }).catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] popular services fetch failed:', e?.message);
          return { data: [] };
        }),
        serviceApi.getAll({ limit: 6 }).catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] services fetch failed:', e?.message);
          return { data: [] };
        }),
        providerApi.getAll({ topRated: true }).catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] top rated providers fetch failed:', e?.message);
          return { data: [] };
        }),
        providerApi.getAll(nearbyParams).catch((e) => {
          if (__DEV__) console.warn('[HomeScreen] nearby providers fetch failed:', e?.message);
          return { data: [] };
        }),
        bannerApi && typeof bannerApi.getBanner === 'function'
          ? bannerApi.getBanner().catch((e) => {
              if (__DEV__) console.warn('[HomeScreen] banner fetch failed:', e?.message);
              return { data: null };
            })
          : Promise.resolve({ data: null })
      ]);

      const allCategories = extractArray(allCatRes);
      let quickList = extractArray(quickCatRes);
      let popList = extractArray(popCatRes);
      const servicesList = extractArray(servRes);
      let topRatedList = extractArray(topProvRes);
      const allProvidersList = extractArray(allProvRes);

      // Business logic fallbacks if specific filter flags yield empty but general active records exist
      if (quickList.length === 0 && allCategories.length > 0) {
        quickList = allCategories.slice(0, 4);
      }
      if (popList.length === 0 && allCategories.length > 0) {
        popList = allCategories.slice(0, 3);
      }
      if (topRatedList.length === 0 && allProvidersList.length > 0) {
        topRatedList = allProvidersList.slice(0, 3);
      }

      if (__DEV__) {
        console.log('[HomeScreen] API Parameters & Location Status:', {
          permissionStatus,
          coordinatesAvailable: Boolean(location?.latitude && location?.longitude),
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          city: location?.city ?? null,
          nearbyQueryParams: nearbyParams
        });
        console.log('[HomeScreen] Data Loaded Record Counts:', {
          allCategoriesCount: allCategories.length,
          quickServicesCount: quickList.length,
          popularServicesCount: popList.length,
          servicesCount: servicesList.length,
          topRatedCount: topRatedList.length,
          nearbyProvidersCount: allProvidersList.length
        });
      }

      setCategories(allCategories);
      setQuickServices(quickList);
      setPopularServices(popList);
      setFeaturedServices(servicesList);
      setTopRatedProviders(topRatedList);
      setNearbyProviders(allProvidersList);
      setBannerConfig(bannerRes?.data || null);
    } catch (err) {
      if (__DEV__) {
        console.error('[HomeScreen] Error fetching home data:', err?.message || err);
      }
      setError('Unable to load home services. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location?.city, location?.latitude, location?.longitude]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when screen regains focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const nearbyProvider = nearbyProviders[0] || null;

  // Resolve active display location string
  const displayLocation = location
    ? [location.city, location.state].filter(Boolean).join(', ')
    : 'Select Location';

  return (
    <View style={styles.container}>
      {/* Top Header Row matching Figma: Avatar, Hello Name, Location subtitle, Notification & Search Icons */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Image
            source={{
              uri:
                user?.avatar ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userTextCol}>
            <Text style={styles.greetingText}>Hello, {user?.name?.split(' ')[0] || 'Harsh'}</Text>
            <TouchableOpacity
              style={styles.locationRow}
              activeOpacity={0.7}
              onPress={() => promptLocationFlow(true)}
            >
              <Ionicons
                name="location-sharp"
                size={11}
                color={permissionStatus === 'granted' ? '#34D399' : '#A78BFA'}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                {isLocationLoading ? 'Locating...' : displayLocation}
              </Text>
              <Ionicons name="chevron-forward" size={11} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('SearchTab')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => navigation.navigate('AlertsTab')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Error message with retry button */}
        {error ? (
          <View style={styles.errorBannerBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#F87171" style={{ marginRight: 8 }} />
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Global Loading Indicator when initial loading */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Loading marketplace services...</Text>
          </View>
        ) : null}

        {/* Hero Banner matching Figma */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBadgeRow}>
            <Ionicons name="shield-checkmark" size={11} color="#C084FC" />
            <Text style={styles.heroBadgeText}>VETTED LOCAL EXPERTS</Text>
          </View>

          <Text style={styles.heroTitle}>Trusted Professionals,{"\n"}Right At Your Door</Text>
          <Text style={styles.heroSubtitle}>Book reliable services near you</Text>

          <View style={styles.heroBottomRow}>
            <TouchableOpacity
              style={styles.findServiceButton}
              onPress={() => navigation.navigate('SearchTab')}
              activeOpacity={0.8}
            >
              <Text style={styles.findServiceBtnText}>Find a Service</Text>
              <Ionicons name="arrow-forward" size={14} color="#161420" />
            </TouchableOpacity>

            <View style={styles.expertsBadge}>
              <View style={styles.expertsAvatarsRow}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&auto=format&fit=crop&q=80' }}
                  style={[styles.miniAvatar, { zIndex: 3 }]}
                />
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&auto=format&fit=crop&q=80' }}
                  style={[styles.miniAvatar, { marginLeft: -8, zIndex: 2 }]}
                />
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=50&auto=format&fit=crop&q=80' }}
                  style={[styles.miniAvatar, { marginLeft: -8, zIndex: 1 }]}
                />
              </View>
              <Text style={styles.expertsBadgeText}>12k+ experts</Text>
            </View>
          </View>
        </View>

        {/* Quick Services Section matching Figma */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Quick Services</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SearchTab')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {quickServices.length === 0 ? (
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>No quick services currently featured.</Text>
            </View>
          ) : (
            <View style={styles.quickServicesGrid}>
              {quickServices.slice(0, 4).map((item) => (
                <TouchableOpacity
                  key={item._id || item.id}
                  style={styles.quickServiceCard}
                  onPress={() => {
                    navigation.navigate('CategoryServices', {
                      categoryId: item._id,
                      categoryName: item.name,
                      categoryDescription: item.description
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickIconCircle}>
                    <Ionicons name={resolveIconName(item.icon, item.name)} size={18} color="#A78BFA" />
                  </View>
                  <Text style={styles.quickServiceTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.quickServiceSubtitle} numberOfLines={1}>
                    {item.description || 'Repairs & Care'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Popular Services Section matching Figma */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Popular Services</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SearchTab')}>
              <Text style={styles.seeAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          {popularServices.length === 0 ? (
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>No popular services currently featured.</Text>
            </View>
          ) : (
            <View style={styles.popularRow}>
              {popularServices.slice(0, 3).map((item, index) => {
                const defaultPrices = [299, 499, 599];
                const displayPrice = item.basePrice || item.price || defaultPrices[index % defaultPrices.length];
                return (
                  <TouchableOpacity
                    key={item._id || item.id}
                    style={styles.popularServiceCard}
                    onPress={() => {
                      navigation.navigate('CategoryServices', {
                        categoryId: item._id,
                        categoryName: item.name,
                        categoryDescription: item.description
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.popularIconCircle}>
                      <Ionicons name={resolveIconName(item.icon, item.name)} size={18} color="#A78BFA" />
                    </View>
                    <Text style={styles.popularCardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.popularPriceFrom}>
                      From <Text style={styles.popularPriceVal}>₹{displayPrice}</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Top Rated Professionals matching Figma */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Top Rated Professionals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SearchTab')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {topRatedProviders.length === 0 ? (
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>No top rated professionals currently featured.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {topRatedProviders.map((provider) => (
                <View key={provider._id} style={styles.topRatedCard}>
                  <Image
                    source={{
                      uri:
                        provider.avatar ||
                        'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=120&auto=format&fit=crop&q=80'
                    }}
                    style={styles.topRatedAvatar}
                  />
                  <View style={styles.topRatedInfo}>
                    <View style={styles.providerTitleRow}>
                      <Text style={styles.topRatedName} numberOfLines={1}>
                        {provider.businessName || provider.user?.name || 'Professional'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
                    </View>
                    <Text style={styles.topRatedCategory}>
                      {provider.specialization || (provider.categories && provider.categories[0]?.name) || 'Service Expert'}
                    </Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={11} color="#F59E0B" />
                      <Text style={styles.ratingNum}>
                        {formatRating(provider.rating, '5.0')}
                      </Text>
                      <Text style={styles.dotDivider}>•</Text>
                      <Text style={styles.expText}>{provider.experienceYears || 0} yrs exp</Text>
                    </View>
                    {provider.pricing?.basePrice ? (
                      <Text style={styles.topRatedPrice}>
                        From <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>₹{provider.pricing.basePrice}</Text>
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.viewBtnPurple}
                    onPress={() => navigation.navigate('ProviderDetail', { providerId: provider._id })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Available Near You Section matching Figma */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Available Near You</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SearchTab')}>
              <Text style={styles.seeAllText}>View map</Text>
            </TouchableOpacity>
          </View>

          {nearbyProvider ? (
            <View style={styles.availableNearCard}>
              <Image
                source={{
                  uri:
                    nearbyProvider.avatar ||
                    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80'
                }}
                style={styles.availableAvatar}
              />
              <View style={styles.availableInfo}>
                <View style={styles.providerTitleRow}>
                  <Text style={styles.topRatedName} numberOfLines={1}>
                    {nearbyProvider.businessName || nearbyProvider.user?.name || 'Professional'}
                  </Text>
                  <Ionicons name="checkmark-circle" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.topRatedCategory}>
                  {nearbyProvider.specialization || (nearbyProvider.categories && nearbyProvider.categories[0]?.name) || 'Service Expert'} • {nearbyProvider.experienceYears || 0} years
                </Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text style={styles.ratingNum}>
                    {formatRating(nearbyProvider.rating, '5.0')}
                  </Text>
                  <Text style={styles.dotDivider}>•</Text>
                  <Text style={styles.expText}>
                    {nearbyProvider.distance != null
                      ? `${typeof nearbyProvider.distance === 'number' ? nearbyProvider.distance.toFixed(1) : nearbyProvider.distance}km away`
                      : location?.city ? `Serving ${location.city}` : 'Serving your city'}
                  </Text>
                </View>
                <Text style={styles.availableNowText}>Available now</Text>
              </View>

              <TouchableOpacity
                style={styles.requestOutlineBtn}
                onPress={() => navigation.navigate('ProviderDetail', { providerId: nearbyProvider._id })}
                activeOpacity={0.8}
              >
                <Text style={styles.requestBtnText}>Request</Text>
              </TouchableOpacity>
            </View>
          ) : permissionStatus !== 'granted' ? (
            <TouchableOpacity
              style={styles.locationPromptCard}
              onPress={() => promptLocationFlow(true)}
              activeOpacity={0.8}
            >
              <View style={styles.locationPromptIconBox}>
                <Ionicons name="navigate-circle-outline" size={24} color="#A78BFA" />
              </View>
              <View style={styles.locationPromptTextCol}>
                <Text style={styles.locationPromptTitle}>Enable location for nearby providers</Text>
                <Text style={styles.locationPromptSubtitle}>
                  Tap to discover vetted professionals right around you
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.emptySectionBox}>
              <Text style={styles.emptySectionText}>No active providers currently in this area.</Text>
            </View>
          )}
        </View>

        {/* Promotional Coupon Banner matching Figma (Admin-Controlled) */}
        {bannerConfig && bannerConfig.isEnabled !== false ? (
          <View style={styles.promoBanner}>
            <View style={styles.promoTextCol}>
              <Text style={styles.promoSmallTag}>
                {bannerConfig.badgeText || 'FIRST SERVICE ORDER'}
              </Text>
              <Text style={styles.promoTitle}>
                {bannerConfig.title || 'Get ₹100 OFF'}
              </Text>
              <Text style={styles.promoSub}>
                {bannerConfig.subtitle || 'Book your first service today'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => {
                const destination = bannerConfig.targetRoute || 'SearchTab';
                navigation.navigate(destination);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.bookNowText}>
                {bannerConfig.buttonLabel || 'Book Now'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* All Services Grid matching Figma (12 categories) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>All Services</Text>
          <View style={styles.allServicesGrid}>
            {(categories.length > 0 ? categories : [
              { _id: 'as1', name: 'Electrician', icon: 'flash-outline' },
              { _id: 'as2', name: 'Mechanic', icon: 'construct-outline' },
              { _id: 'as3', name: 'Electrical Tech', icon: 'bulb-outline' },
              { _id: 'as4', name: 'Mechanical Tech', icon: 'hardware-chip-outline' },
              { _id: 'as5', name: 'Plumber', icon: 'water-outline' },
              { _id: 'as6', name: 'AC Technician', icon: 'snow-outline' },
              { _id: 'as7', name: 'Appliance Repair', icon: 'tv-outline' },
              { _id: 'as8', name: 'Carpenter', icon: 'hammer-outline' },
              { _id: 'as9', name: 'Painter', icon: 'color-palette-outline' },
              { _id: 'as10', name: 'Cleaner', icon: 'sparkles-outline' },
              { _id: 'as11', name: 'Pest Control', icon: 'shield-outline' },
              { _id: 'as12', name: 'Other Services', icon: 'apps-outline' }
            ]).map((item) => (
              <TouchableOpacity
                key={item._id || item.id}
                style={styles.allServiceCard}
                onPress={() => {
                  if (item._id && !item._id.startsWith('as')) {
                    navigation.navigate('CategoryServices', {
                      categoryId: item._id,
                      categoryName: item.name,
                      categoryDescription: item.description
                    });
                  } else {
                    navigation.navigate('SearchTab');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.allServiceIconCircle}>
                  <Ionicons name={resolveIconName(item.icon, item.name)} size={18} color="#A78BFA" />
                </View>
                <Text style={styles.allServiceLabel} numberOfLines={2}>
                  {item.name || item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Trust Footer matching Figma */}
        <View style={styles.trustFooter}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#8B5CF6" />
          <View style={styles.trustTextCol}>
            <Text style={styles.trustTitle}>Service with confidence</Text>
            <Text style={styles.trustSubtitle}>
              Verified experts • Transparent pricing • Support when you need it
            </Text>
          </View>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0B0B0E'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    backgroundColor: '#262238'
  },
  userTextCol: {
    justifyContent: 'center'
  },
  greetingText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2
  },
  locationText: {
    fontSize: 11,
    color: '#9CA3AF',
    maxWidth: 140
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    alignItems: 'center',
    justifyContent: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  heroBanner: {
    backgroundColor: '#1C162E',
    borderRadius: 18,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#31284F'
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C084FC',
    letterSpacing: 0.5
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 4
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  findServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6
  },
  findServiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#161420'
  },
  expertsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161224',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#292242'
  },
  expertsAvatarsRow: {
    flexDirection: 'row'
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1C162E'
  },
  expertsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D8B4FE'
  },
  sectionContainer: {
    marginTop: 18
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6'
  },
  quickServicesGrid: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8
  },
  quickServiceCard: {
    width: '23%',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center'
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  quickServiceTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  quickServiceSubtitle: {
    fontSize: 9,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 2
  },
  popularRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10
  },
  popularServiceCard: {
    width: '31%',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center'
  },
  popularIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  popularCardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4
  },
  popularPriceFrom: {
    fontSize: 10,
    color: '#9CA3AF'
  },
  popularPriceVal: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  topRatedCard: {
    flexDirection: 'row',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center'
  },
  topRatedAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#262238'
  },
  topRatedInfo: {
    flex: 1
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topRatedName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  topRatedCategory: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3
  },
  ratingNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 3
  },
  dotDivider: {
    fontSize: 11,
    color: '#6B7280',
    marginHorizontal: 4
  },
  expText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  topRatedPrice: {
    fontSize: 10,
    color: '#9CA3AF'
  },
  viewBtnPurple: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  availableNearCard: {
    flexDirection: 'row',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center'
  },
  availableAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#262238'
  },
  availableInfo: {
    flex: 1
  },
  availableNowText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600'
  },
  requestOutlineBtn: {
    borderWidth: 1,
    borderColor: '#36314D',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10
  },
  requestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0'
  },
  promoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C152B',
    borderWidth: 1,
    borderColor: '#2D2348',
    borderRadius: 16,
    padding: 16,
    marginTop: 18
  },
  promoTextCol: {
    flex: 1
  },
  promoSmallTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 0.5
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 2
  },
  promoSub: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  bookNowBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10
  },
  bookNowText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  allServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 10
  },
  allServiceCard: {
    width: '23%',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginBottom: 8
  },
  allServiceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#241F36',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  allServiceLabel: {
    fontSize: 10,
    color: '#E2E8F0',
    textAlign: 'center',
    fontWeight: '500'
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13111C',
    borderWidth: 1,
    borderColor: '#221E31',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 12
  },
  trustTextCol: {
    flex: 1
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  trustSubtitle: {
    fontSize: 10,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 14
  },
  emptySectionBox: {
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4
  },
  emptySectionText: {
    fontSize: 12,
    color: '#71717A'
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF'
  },
  errorBannerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2A1515',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 10
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#FCA5A5'
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 10
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  locationPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#2F264A',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginVertical: 4
  },
  locationPromptIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#261F3D',
    alignItems: 'center',
    justifyContent: 'center'
  },
  locationPromptTextCol: {
    flex: 1
  },
  locationPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2
  },
  locationPromptSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15
  }
});

