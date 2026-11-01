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
const BANNER_ASPECT_RATIO = 2.1; // ~2.1:1 aspect ratio yielding ~145-155px height on 360px device
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
          // Fallback if scrollToIndex failed
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

  // Calculate proportional height based on 2.4:1 aspect ratio (1200 x 500)
  const bannerHeight = Math.round(containerWidth / BANNER_ASPECT_RATIO);

  const renderItem = ({ item, index }) => {
    const isLoaded = Boolean(imageLoadedStates[item._id || index]);
    const isError = Boolean(imageErrorStates[item._id || index]);
    const hasImage = Boolean(item.imageUrl) && !isError;
    const isClickable = item.destinationType && item.destinationType !== 'none';

    return (
      <TouchableOpacity
        key={item._id || String(index)}
        activeOpacity={0.92}
        onPress={() => handleBannerPress(item)}
        style={[styles.slideCard, { width: containerWidth, height: bannerHeight }]}
        accessibilityRole="button"
        accessibilityLabel={item.title || 'Promotional Banner'}
      >
        {/* Placeholder / Skeleton Loader behind the image while loading */}
        {!isLoaded && hasImage && (
          <View style={[styles.skeletonBox, { width: containerWidth, height: bannerHeight }]}>
            <ActivityIndicator size="small" color="#7C3AED" />
          </View>
        )}

        {/* Fallback View only when image fails or is missing */}
        {(!hasImage || isError) && (
          <View style={[styles.fallbackCard, { width: containerWidth, height: bannerHeight }]}>
            <View style={styles.fallbackIconWrap}>
              <Ionicons name="sparkles" size={24} color="#A78BFA" />
            </View>
            {item.title ? (
              <Text style={styles.fallbackTitle} numberOfLines={1}>
                {item.title}
              </Text>
            ) : null}
            {item.subtitle ? (
              <Text style={styles.fallbackSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        )}

        {/* Pure Promotional Artwork Graphic - No Text/CTA Overlays */}
        {hasImage && (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
            onLoad={() => {
              setImageLoadedStates((prev) => ({ ...prev, [item._id || index]: true }));
            }}
            onError={() => {
              setImageErrorStates((prev) => ({ ...prev, [item._id || index]: true }));
            }}
          />
        )}
      </TouchableOpacity>
    );
  };

  // If only 1 banner exists, display it directly without unnecessary animation
  if (totalBanners === 1) {
    return (
      <View style={styles.container} onLayout={onLayout}>
        {renderItem({ item: validBanners[0], index: 0 })}
      </View>
    );
  }

  // Multiple banners: render full interactive infinite carousel with dots below
  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={[styles.carouselClipWrap, { width: containerWidth, height: bannerHeight }]}>
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
      </View>

      {/* Small, elegant pagination dots positioned cleanly below the image */}
      <View style={styles.paginationRow}>
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
    width: '100%',
    marginTop: 8,
    marginBottom: 0,
    alignItems: 'center'
  },
  carouselClipWrap: {
    borderRadius: 20,
    overflow: 'hidden'
  },
  slideCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#161424',
    position: 'relative'
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20
  },
  skeletonBox: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#161424',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    zIndex: 0
  },
  fallbackCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C162E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 20,
    zIndex: 1
  },
  fallbackIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2E2250',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2
  },
  fallbackSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    marginTop: 3
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8
  },
  dot: {
    height: 4,
    borderRadius: 2
  },
  activeDot: {
    width: 18,
    backgroundColor: '#A78BFA'
  },
  inactiveDot: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)'
  }
});
