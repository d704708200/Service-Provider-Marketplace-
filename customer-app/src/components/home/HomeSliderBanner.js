import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Linking,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_MARGIN = 16;
const DEFAULT_CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_MARGIN * 2;
const SLIDE_INTERVAL = 3500; // 3.5 seconds

export default function HomeSliderBanner({ banners = [], navigation }) {
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CARD_WIDTH);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [imageLoadedStates, setImageLoadedStates] = useState({});
  const [imageErrorStates, setImageErrorStates] = useState({});

  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const activeIndexRef = useRef(0);

  // Keep ref synchronized
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Filter only valid items
  const validBanners = Array.isArray(banners)
    ? banners.filter((b) => b && (b.imageUrl || b.title))
    : [];

  const totalBanners = validBanners.length;

  // Measure dynamic width from container
  const onLayout = useCallback((e) => {
    const { width } = e.nativeEvent.layout;
    if (width > 0 && Math.abs(width - containerWidth) > 2) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  // Auto sliding timer management
  const startTimer = useCallback(() => {
    if (totalBanners <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (flatListRef.current && totalBanners > 1) {
        const nextIndex = (activeIndexRef.current + 1) % totalBanners;
        try {
          flatListRef.current.scrollToIndex({
            index: nextIndex,
            animated: true
          });
          setActiveIndex(nextIndex);
        } catch {
          // Fallback if scrollToIndex failed (e.g. item not rendered yet)
          flatListRef.current.scrollToOffset({
            offset: nextIndex * containerWidth,
            animated: true
          });
          setActiveIndex(nextIndex);
        }
      }
    }, SLIDE_INTERVAL);
  }, [totalBanners, containerWidth]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Setup / teardown timer based on user interaction and banner count
  useEffect(() => {
    if (totalBanners > 1 && !isInteracting) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [totalBanners, isInteracting, startTimer, stopTimer]);

  // Manual scroll event handlers
  const handleScrollBeginDrag = () => {
    setIsInteracting(true);
    stopTimer();
  };

  const handleScrollEndDrag = () => {
    setIsInteracting(false);
  };

  const handleMomentumScrollEnd = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / (containerWidth || 1));
    const clampedIndex = Math.max(0, Math.min(newIndex, totalBanners - 1));
    setActiveIndex(clampedIndex);
    setIsInteracting(false);
  };

  // Banner click navigation handler
  const handleBannerPress = (banner) => {
    if (!banner || !navigation) return;
    const { destinationType, destinationId, title } = banner;

    if (!destinationType || destinationType === 'none') {
      return;
    }

    try {
      switch (destinationType) {
        case 'category':
          if (destinationId) {
            navigation.navigate('CategoryServices', {
              categoryId: destinationId,
              categoryName: title || 'Category'
            });
          }
          break;

        case 'service':
          if (destinationId) {
            navigation.navigate('ServiceDetail', {
              serviceId: destinationId,
              service: { _id: destinationId, name: title }
            });
          }
          break;

        case 'search':
          navigation.navigate('SearchTab', {
            search: destinationId || title || ''
          });
          break;

        case 'offer':
          navigation.navigate('SearchTab', {
            search: destinationId || 'Offer'
          });
          break;

        case 'screen':
          if (destinationId) {
            navigation.navigate(destinationId);
          }
          break;

        case 'url':
          if (
            destinationId &&
            (destinationId.startsWith('http://') || destinationId.startsWith('https://'))
          ) {
            Linking.openURL(destinationId).catch((err) => {
              if (__DEV__) console.warn('[HomeSliderBanner] URL open failed:', err);
            });
          }
          break;

        default:
          break;
      }
    } catch (err) {
      if (__DEV__) console.warn('[HomeSliderBanner] Navigation failed:', err);
    }
  };

  // If no banners exist, cleanly hide without layout shifts
  if (totalBanners === 0) {
    return null;
  }

  // Calculate banner height with 16:7.5 aspect ratio
  const bannerHeight = Math.max(140, Math.round(containerWidth * 0.46));

  const renderItem = ({ item, index }) => {
    const isLoaded = Boolean(imageLoadedStates[item._id || index]);
    const isError = Boolean(imageErrorStates[item._id || index]);
    const hasImage = Boolean(item.imageUrl) && !isError;

    return (
      <TouchableOpacity
        key={item._id || String(index)}
        activeOpacity={item.destinationType && item.destinationType !== 'none' ? 0.9 : 1}
        onPress={() => handleBannerPress(item)}
        style={[styles.slideCard, { width: containerWidth, height: bannerHeight }]}
      >
        {/* Placeholder / Skeleton Loader behind the image */}
        {!isLoaded && hasImage && (
          <View style={[styles.skeletonBox, { height: bannerHeight }]}>
            <ActivityIndicator size="small" color="#8B5CF6" />
          </View>
        )}

        {/* Fallback View when image fails or is missing */}
        {(!hasImage || isError) && (
          <View style={[styles.fallbackCard, { height: bannerHeight }]}>
            <View style={styles.fallbackContent}>
              <View style={styles.fallbackIconWrap}>
                <Ionicons name="sparkles" size={20} color="#A78BFA" />
              </View>
              <Text style={styles.fallbackTitle} numberOfLines={2}>
                {item.title || 'Special Promotion'}
              </Text>
              {item.subtitle ? (
                <Text style={styles.fallbackSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Banner Graphic Image */}
        {hasImage && (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.bannerImage, { height: bannerHeight }]}
            resizeMode="cover"
            onLoad={() => {
              setImageLoadedStates((prev) => ({ ...prev, [item._id || index]: true }));
            }}
            onError={() => {
              setImageErrorStates((prev) => ({ ...prev, [item._id || index]: true }));
            }}
          />
        )}

        {/* Gradient / Dark text backdrop overlay if title or subtitle present */}
        {hasImage && (item.title || item.subtitle) && (
          <View style={styles.textOverlay}>
            <Text style={styles.overlayTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.overlaySubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {/* Action badge if destination configured */}
        {item.destinationType && item.destinationType !== 'none' && (
          <View style={styles.actionPill}>
            <Text style={styles.actionPillText}>Explore</Text>
            <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // If only 1 banner exists, display it without unnecessary animation
  if (totalBanners === 1) {
    return (
      <View style={[styles.container, { width: '100%' }]} onLayout={onLayout}>
        {renderItem({ item: validBanners[0], index: 0 })}
      </View>
    );
  }

  // Multiple banners: render full interactive infinite carousel
  return (
    <View style={[styles.container, { width: '100%' }]} onLayout={onLayout}>
      <FlatList
        ref={flatListRef}
        data={validBanners}
        renderItem={renderItem}
        keyExtractor={(item, index) => item._id || String(index)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={containerWidth}
        snapToAlignment="center"
        decelerationRate="fast"
        bounces={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: containerWidth,
          offset: containerWidth * index,
          index
        })}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={3}
      />

      {/* Pagination Indicator Dots */}
      <View style={styles.paginationContainer}>
        {validBanners.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.activeDot : styles.inactiveDot
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative'
  },
  slideCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1C162E',
    borderWidth: 1,
    borderColor: '#2D2348',
    position: 'relative',
    justifyContent: 'center'
  },
  skeletonBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C152B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0
  },
  bannerImage: {
    width: '100%',
    borderRadius: 15,
    zIndex: 1
  },
  fallbackCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1D1432',
    padding: 16,
    justifyContent: 'center',
    zIndex: 1
  },
  fallbackContent: {
    maxWidth: '80%'
  },
  fallbackIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2E2250',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 3
  },
  textOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(11, 8, 20, 0.72)',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    zIndex: 2
  },
  overlayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  overlaySubtitle: {
    fontSize: 11,
    color: '#E5E7EB',
    marginTop: 2
  },
  actionPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(124, 58, 237, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 3
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
    zIndex: 10
  },
  dot: {
    borderRadius: 3,
    height: 4.5
  },
  activeDot: {
    width: 14,
    backgroundColor: '#A78BFA'
  },
  inactiveDot: {
    width: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)'
  }
});
