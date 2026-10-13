import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

const SAMPLE_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Booking Confirmed',
    description: 'Raj Kumar has accepted your Electrical Inspection request for today at 2:30 PM.',
    time: '10m ago',
    read: false,
    icon: 'checkmark-circle-outline',
    iconColor: '#34D399'
  },
  {
    id: 'n2',
    title: 'Provider On The Way',
    description: 'Your service professional Amit Verma is heading to Civil Lines, Prayagraj.',
    time: '1h ago',
    read: false,
    icon: 'car-outline',
    iconColor: '#A78BFA'
  },
  {
    id: 'n3',
    title: 'Special Discount 15% OFF',
    description: 'Enjoy 15% off on your next AC service maintenance booking. Use code WELCOME15.',
    time: '1d ago',
    read: true,
    icon: 'pricetag-outline',
    iconColor: '#F59E0B'
  },
  {
    id: 'n4',
    title: 'Service Completed',
    description: 'Your plumbing repair job has been marked completed. Please leave a review!',
    time: '2d ago',
    read: true,
    icon: 'star-outline',
    iconColor: '#7C3AED'
  }
];

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleMarkAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const renderItem = ({ item }) => (
    <View style={[styles.notificationCard, !item.read && styles.unreadCard]}>
      <View style={[styles.iconBox, { backgroundColor: '#241F36' }]}>
        <Ionicons name={item.icon} size={20} color={item.iconColor} />
      </View>

      <View style={styles.contentCol}>
        <View style={styles.topRow}>
          <Text style={styles.titleText}>{item.title}</Text>
          <Text style={styles.timeText}>{item.time}</Text>
        </View>
        <Text style={styles.descText}>{item.description}</Text>
      </View>

      {!item.read && <View style={styles.unreadDot} />}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.mainTitle}>Notifications</Text>
          <Text style={styles.subtitle}>Alerts & Status Updates</Text>
        </View>

        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={48} color="#252136" />
            <Text style={styles.emptyText}>No notifications right now</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 16
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  markAllText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start'
  },
  unreadCard: {
    borderColor: '#3B3354'
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
    color: '#FFFFFF'
  },
  timeText: {
    fontSize: 11,
    color: '#71717A'
  },
  descText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 16
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C3AED',
    marginLeft: 8,
    marginTop: 4
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 12
  }
});
