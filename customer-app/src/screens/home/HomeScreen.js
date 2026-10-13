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
import { categoryApi, serviceApi, providerApi } from '../../services/api';
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

  const [categories, setCategories] = useState([]);
  const [quickServices, setQuickServices] = useState([]);
  const [popularServices, setPopularServices] = useState([]);
  const [featuredServices, setFeaturedServices] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [allCatRes, quickCatRes, popCatRes, servRes, provRes] = await Promise.all([
        categoryApi.getAll().catch(() => ({ data: [] })),
        categoryApi.getAll({ quickServices: true }).catch(() => ({ data: [] })),
        categoryApi.getAll({ popularServices: true }).catch(() => ({ data: [] })),
        serviceApi.getAll({ limit: 6 }).catch(() => ({ data: [] })),
        providerApi.getAll({ limit: 6 }).catch(() => ({ data: [] }))
      ]);

      const allCategories = allCatRes.data || [];
      const quickList = quickCatRes.data || [];
      const popList = popCatRes.data || [];

      setCategories(allCategories);
      setQuickServices(quickList);
      setPopularServices(popList);
      setFeaturedServices(servRes.data || []);
      setTopProviders(provRes.data || []);
    } catch (err) {
      // Handled gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const primaryProvider = topProviders[0] || {
    _id: 'default_prov_1',
    businessName: 'Raj Electrical Services',
    specialization: 'Electrician',
    rating: { average: 4.8 },
    experienceYears: 8,
    pricing: { basePrice: 499 }
  };

  const nearbyProvider = topProviders[1] || {
    _id: 'default_prov_2',
    businessName: 'Raj Kumar',
    specialization: 'Electrician',
    rating: { average: 4.8 },
    experienceYears: 8,
    distance: 1.4
  };

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
            <TouchableOpacity style={styles.locationRow} activeOpacity={0.8}>
              <Ionicons name="location-sharp" size={11} color="#A78BFA" />
              <Text style={styles.locationText} numberOfLines={1}>
                Prayagraj, Uttar Pradesh
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

          <View style={styles.topRatedCard}>
            <Image
              source={{
                uri:
                  primaryProvider.avatar ||
                  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=120&auto=format&fit=crop&q=80'
              }}
              style={styles.topRatedAvatar}
            />
            <View style={styles.topRatedInfo}>
              <View style={styles.providerTitleRow}>
                <Text style={styles.topRatedName} numberOfLines={1}>
                  {primaryProvider.businessName || 'Raj Electrical Services'}
                </Text>
                <Ionicons name="checkmark-circle" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.topRatedCategory}>{primaryProvider.specialization || 'Electrician'}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={styles.ratingNum}>
                  {primaryProvider.rating?.average ? primaryProvider.rating.average.toFixed(1) : '4.8'}
                </Text>
                <Text style={styles.dotDivider}>•</Text>
                <Text style={styles.expText}>{primaryProvider.experienceYears || 8} yrs exp</Text>
              </View>
              <Text style={styles.topRatedPrice}>
                From <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>₹{primaryProvider.pricing?.basePrice || 499}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewBtnPurple}
              onPress={() => navigation.navigate('ProviderDetail', { providerId: primaryProvider._id })}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Near You Section matching Figma */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Available Near You</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SearchTab')}>
              <Text style={styles.seeAllText}>View map</Text>
            </TouchableOpacity>
          </View>

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
                  {nearbyProvider.businessName || 'Raj Kumar'}
                </Text>
                <Ionicons name="checkmark-circle" size={13} color="#7C3AED" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.topRatedCategory}>
                {nearbyProvider.specialization || 'Electrician'} • {nearbyProvider.experienceYears || 8} years
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={styles.ratingNum}>
                  {nearbyProvider.rating?.average ? nearbyProvider.rating.average.toFixed(1) : '4.8'}
                </Text>
                <Text style={styles.dotDivider}>•</Text>
                <Text style={styles.expText}>{nearbyProvider.distance || 1.4}km</Text>
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
        </View>

        {/* Promotional Coupon Banner matching Figma */}
        <View style={styles.promoBanner}>
          <View style={styles.promoTextCol}>
            <Text style={styles.promoSmallTag}>FIRST SERVICE ORDER</Text>
            <Text style={styles.promoTitle}>Get ₹100 OFF</Text>
            <Text style={styles.promoSub}>Book your first service today</Text>
          </View>
          <TouchableOpacity
            style={styles.bookNowBtn}
            onPress={() => navigation.navigate('SearchTab')}
            activeOpacity={0.8}
          >
            <Text style={styles.bookNowText}>Book Now</Text>
          </TouchableOpacity>
        </View>

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
    justifyContent: 'space-between'
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
    justifyContent: 'space-between'
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
    justifyContent: 'space-between',
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
  }
});
