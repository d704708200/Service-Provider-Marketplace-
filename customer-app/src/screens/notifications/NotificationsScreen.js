import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { notificationApi } from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};

const getNotificationIcon = (type, title = '') => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('accepted') || lowerTitle.includes('confirmed')) {
    return { name: 'checkmark-circle-outline', color: '#34D399' };
  }
  if (lowerTitle.includes('started') || lowerTitle.includes('way')) {
    return { name: 'car-outline', color: '#A78BFA' };
  }
  if (lowerTitle.includes('cancelled') || lowerTitle.includes('rejected')) {
    return { name: 'close-circle-outline', color: '#EF4444' };
  }
  if (lowerTitle.includes('material') || lowerTitle.includes('quotation')) {
    return { name: 'construct-outline', color: '#F59E0B' };
  }
  if (lowerTitle.includes('completed')) {
    return { name: 'star-outline', color: '#7C3AED' };
  }
  return { name: 'notifications-outline', color: '#A78BFA' };
};

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { unreadCount, decrementUnreadCount, clearUnreadCount, refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationApi.getNotifications({ limit: 50 });
      if (response?.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
      refreshUnreadCount();
    } catch (err) {
      console.warn('Failed to fetch notifications:', err.userMessage || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      clearUnreadCount();
    } catch (err) {
      console.warn('Mark all read error:', err.message);
    }
  };

  const handlePressItem = async (item) => {
    // 1. Mark as read on backend if unread
    if (!item.isRead) {
      try {
        await notificationApi.markAsRead(item._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))
        );
        decrementUnreadCount(1);
      } catch (err) {
        console.warn('Mark read error:', err.message);
      }
    }

    // 2. Navigate to relevant screen if bookingId exists
    const bookingId = item.data?.bookingId;
    if (bookingId && navigation?.navigate) {
      navigation.navigate('BookingDetail', { bookingId, id: bookingId });
    }
  };

  const renderItem = ({ item }) => {
    const { name: iconName, color: iconColor } = getNotificationIcon(item.type, item.title);

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={() => handlePressItem(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: '#241F36' }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        <View style={styles.contentCol}>
          <View style={styles.topRow}>
            <Text style={styles.titleText}>{item.title}</Text>
            <Text style={styles.timeText}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.descText}>{item.message}</Text>
        </View>

        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.mainTitle}>Notifications</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0 ? `${unreadCount} unread update(s)` : 'All caught up'}
            </Text>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList showsHorizontalScrollIndicator={false}
          data={notifications}
          keyExtractor={(item) => item._id || item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={48} color={colors.borderLight || colors.border} />
              <Text style={styles.emptyText}>No notifications right now</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    marginRight: 12,
    padding: 4
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  markAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600'
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start'
  },
  unreadCard: {
    borderColor: isDark ? '#3B3354' : '#DDD6FE',
    backgroundColor: isDark ? '#1A1828' : '#F5F3FF'
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  contentCol: {
    flex: 1
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted
  },
  descText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 4
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 12
  }
});
