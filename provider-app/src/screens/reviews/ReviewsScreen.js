import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { reviewApi } from '../../services/api';
import { getApiBaseUrl } from '../../config/env';
import { Header, Card, Badge, EmptyState, ErrorView } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

const STAR_FILTERS = [
  { label: 'All', value: 'all' },
  { label: '5 ★', value: 5 },
  { label: '4 ★', value: 4 },
  { label: '3 ★', value: 3 },
  { label: '2 ★', value: 2 },
  { label: '1 ★', value: 1 }
];

export default function ReviewsScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    averageRating: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const formatAvatarUrl = useCallback((avatarPath) => {
    if (!avatarPath || typeof avatarPath !== 'string') return null;
    const trimmed = avatarPath.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
    if (trimmed.startsWith('/')) {
      const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '');
      return `${baseUrl}${trimmed}`;
    }
    return trimmed;
  }, []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, []);

  const fetchReviews = useCallback(
    async (page = 1, append = false, ratingFilter = selectedFilter) => {
      try {
        if (!append) {
          setError(null);
        }

        const params = {
          page,
          limit: 10
        };

        if (ratingFilter !== 'all') {
          params.rating = ratingFilter;
        }

        const res = await reviewApi.getProviderReviews(params);

        if (res?.success) {
          const newReviews = res.data || [];
          if (append) {
            setReviews((prev) => [...prev, ...newReviews]);
          } else {
            setReviews(newReviews);
          }

          if (res.stats) {
            setStats(res.stats);
          }

          if (res.pagination) {
            setPagination(res.pagination);
          }
        } else {
          throw new Error(res?.message || 'Failed to load reviews');
        }
      } catch (err) {
        console.error('Error fetching provider reviews:', err);
        setError(err.userMessage || err.message || 'Unable to load client reviews');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [selectedFilter]
  );

  useEffect(() => {
    setLoading(true);
    fetchReviews(1, false, selectedFilter);
  }, [fetchReviews, selectedFilter]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews(1, false, selectedFilter);
  }, [fetchReviews, selectedFilter]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    fetchReviews(pagination.page + 1, true, selectedFilter);
  }, [fetchReviews, loading, loadingMore, pagination.page, pagination.totalPages, selectedFilter]);

  const handleSelectFilter = useCallback((filterVal) => {
    setSelectedFilter(filterVal);
    setLoading(true);
  }, []);

  // Compute distribution percentages based on total reviews
  const distributionPercentages = useMemo(() => {
    const total = stats.total || 0;
    const dist = stats.distribution || {};
    return {
      5: total > 0 ? Math.round(((dist[5] || 0) / total) * 100) : 0,
      4: total > 0 ? Math.round(((dist[4] || 0) / total) * 100) : 0,
      3: total > 0 ? Math.round(((dist[3] || 0) / total) * 100) : 0,
      2: total > 0 ? Math.round(((dist[2] || 0) / total) * 100) : 0,
      1: total > 0 ? Math.round(((dist[1] || 0) / total) * 100) : 0
    };
  }, [stats]);

  // Render 5 stars helper
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Ionicons key={i} name="star" size={16} color="#F59E0B" />);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={16} color="#F59E0B" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={16} color="#4B5563" />);
      }
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <Header
        title="Reviews & Ratings"
        subtitle="Customer feedback & rating breakdown"
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Loading State */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading client feedback & ratings...</Text>
          </View>
        ) : error ? (
          /* Error State (prevents showing false/unverified ratings when request fails) */
          <ErrorView
            title="Could Not Load Reviews"
            message={error}
            onRetry={() => {
              setLoading(true);
              fetchReviews(1, false, selectedFilter);
            }}
          />
        ) : (
          <>
            {/* Rating Overview Card */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryTopRow}>
                {/* Big Score Box */}
                <View style={styles.scoreContainer}>
                  <Text style={styles.bigScoreText}>
                    {stats.total > 0 && stats.averageRating
                      ? Number(stats.averageRating).toFixed(1)
                      : stats.total === 0
                      ? '0.0'
                      : Number(stats.averageRating || 0).toFixed(1)}
                  </Text>
                  <View style={styles.starsRow}>
                    {renderStars(stats.total > 0 ? (stats.averageRating || 0) : 0)}
                  </View>
                  <Text style={styles.totalReviewsText}>
                    {stats.total > 0
                      ? `Based on ${stats.total} ${stats.total === 1 ? 'review' : 'reviews'}`
                      : 'No client reviews yet'}
                  </Text>
                </View>

                {/* Rating Distribution Bars */}
                <View style={styles.distributionContainer}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = stats.distribution?.[star] || 0;
                    const pct = distributionPercentages[star] || 0;
                    return (
                      <View key={star} style={styles.distRow}>
                        <Text style={styles.distStarLabel}>{star}★</Text>
                        <View style={styles.distBarTrack}>
                          <View style={[styles.distBarFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.distCountLabel}>{count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Card>

            {/* Filter Chips */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Filter Reviews</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {STAR_FILTERS.map((f) => {
                  const isSelected = selectedFilter === f.value;
                  return (
                    <TouchableOpacity
                      key={String(f.value)}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => handleSelectFilter(f.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Reviews List or Empty State */}
            {reviews.length === 0 ? (
              <EmptyState
                icon="star-outline"
                title="No Reviews Found"
                description={
                  selectedFilter !== 'all'
                    ? `No ${selectedFilter}-star reviews received yet.`
                    : 'Customer feedback and star ratings will appear here as soon as clients review your completed services.'
                }
              />
            ) : (
              <View style={styles.reviewsList}>
                <Text style={styles.reviewsListHeading}>
                  {selectedFilter === 'all'
                    ? `Customer Feedback (${pagination.total || reviews.length})`
                    : `${selectedFilter} Star Reviews (${pagination.total || reviews.length})`}
                </Text>

                {reviews.map((item) => {
                  const customerUser = item.customer?.user;
                  const customerName = customerUser?.name || 'Verified Customer';
                  const avatarUrl = formatAvatarUrl(customerUser?.avatar);
                  const initials =
                    customerName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'VC';

                  return (
                    <Card key={item._id} style={styles.reviewCard}>
                      {/* Top Customer Info Row */}
                      <View style={styles.reviewHeader}>
                        <View style={styles.customerRow}>
                          {avatarUrl ? (
                            <Image
                              source={{ uri: avatarUrl }}
                              style={styles.customerAvatar}
                            />
                          ) : (
                            <View style={styles.avatarFallback}>
                              <Text style={styles.avatarInitials}>{initials}</Text>
                            </View>
                          )}
                          <View style={styles.customerMeta}>
                            <Text style={styles.customerName} numberOfLines={1}>
                              {customerName}
                            </Text>
                            <Text style={styles.reviewDate}>
                              {formatDate(item.createdAt)}
                            </Text>
                          </View>
                        </View>

                        {/* Star Badge */}
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={13} color="#F59E0B" />
                          <Text style={styles.ratingBadgeText}>
                            {Number(item.rating || 5).toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      {/* Service & Booking Reference Pill */}
                      {(item.service?.name || item.booking?.bookingReference) && (
                        <View style={styles.bookingMetaRow}>
                          {item.service?.name ? (
                            <View style={styles.servicePill}>
                              <Ionicons name="construct-outline" size={12} color="#A78BFA" />
                              <Text style={styles.servicePillText} numberOfLines={1}>
                                {item.service.name}
                              </Text>
                            </View>
                          ) : null}

                          {item.booking?.bookingReference ? (
                            <View style={styles.bookingRefPill}>
                              <Ionicons name="receipt-outline" size={12} color="#9CA3AF" />
                              <Text style={styles.bookingRefText}>
                                {item.booking.bookingReference}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {/* Review Text */}
                      <Text style={styles.reviewComment}>
                        {item.comment && item.comment.trim()
                          ? item.comment.trim()
                          : 'Client gave a star rating without written comment.'}
                      </Text>
                    </Card>
                  );
                })}

                {/* Pagination / Load More Button */}
                {pagination.page < pagination.totalPages && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                    activeOpacity={0.7}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#A78BFA" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More Reviews</Text>
                        <Ionicons name="chevron-down" size={16} color="#A78BFA" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: spacing.lg
  },
  summaryCard: {
    padding: spacing.lg,
    backgroundColor: '#161424',
    borderWidth: 1,
    borderColor: '#262238',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110
  },
  bigScoreText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    marginBottom: 6
  },
  totalReviewsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center'
  },
  distributionContainer: {
    flex: 1,
    gap: 6,
    justifyContent: 'center'
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  distStarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    width: 24
  },
  distBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#262238',
    borderRadius: 3,
    overflow: 'hidden'
  },
  distBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3
  },
  distCountLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    width: 28,
    textAlign: 'right'
  },
  filterSection: {
    marginBottom: spacing.md
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: '#181628',
    borderWidth: 1,
    borderColor: '#28233D'
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#9061F9'
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF'
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: spacing.sm
  },
  reviewsList: {
    marginTop: spacing.xs
  },
  reviewsListHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.sm
  },
  reviewCard: {
    padding: spacing.md,
    backgroundColor: '#161424',
    borderWidth: 1,
    borderColor: '#242036',
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#262238'
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2D2250',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4C3888'
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD6FE'
  },
  customerMeta: {
    flex: 1
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  reviewDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2A1F0D',
    borderWidth: 1,
    borderColor: '#78350F',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24'
  },
  bookingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
    marginBottom: spacing.xs
  },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F1A38',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  servicePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C4B5FD'
  },
  bookingRefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1F202B',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  bookingRefText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    color: '#E2E8F0',
    marginTop: 4
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: '#1C1930',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2F2752',
    marginTop: spacing.xs,
    marginBottom: spacing.md
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A78BFA'
  }
});

