import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { availabilityApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

const DAYS_OF_WEEK = [
  { day: 0, label: 'Sunday' },
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' }
];

export default function AvailabilityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit slot modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentDay, setCurrentDay] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await availabilityApi.getAvailability();
      if (res?.success && Array.isArray(res.data)) {
        const fullSchedule = DAYS_OF_WEEK.map((d) => {
          const found = res.data.find((item) => item.dayOfWeek === d.day);
          if (found) {
            return found;
          }
          return {
            dayOfWeek: d.day,
            isAvailable: d.day !== 0,
            slots: [{ startTime: '09:00', endTime: '18:00', maxBookings: 1 }]
          };
        });
        setSchedule(fullSchedule);
      }
    } catch (err) {
      console.warn('Error loading availability schedule:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAvailability();
    setRefreshing(false);
  };

  const handleToggleDay = (dayNum) => {
    setSchedule((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek === dayNum) {
          return { ...item, isAvailable: !item.isAvailable };
        }
        return item;
      })
    );
  };

  const handleOpenEditSlots = (dayEntry) => {
    setCurrentDay(dayEntry.dayOfWeek);
    const firstSlot = dayEntry.slots?.[0] || { startTime: '09:00', endTime: '18:00' };
    setStartTime(firstSlot.startTime);
    setEndTime(firstSlot.endTime);
    setEditModalVisible(true);
  };

  const handleSaveSlot = () => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Invalid Time', 'Please enter valid times in HH:mm 24-hour format (e.g. 09:00).');
      return;
    }
    if (startTime >= endTime) {
      Alert.alert('Invalid Time Range', 'Start time must be before end time.');
      return;
    }

    setSchedule((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek === currentDay) {
          return {
            ...item,
            slots: [{ startTime, endTime, maxBookings: 1 }]
          };
        }
        return item;
      })
    );
    setEditModalVisible(false);
  };

  const handleSaveScheduleToBackend = async () => {
    setSaving(true);
    try {
      const res = await availabilityApi.updateAvailability(schedule);
      if (res?.success) {
        Alert.alert('Success', 'Weekly availability schedule saved successfully.');
      }
    } catch (err) {
      Alert.alert('Save Failed', err.userMessage || err.message || 'Could not update availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Weekly Availability"
        subtitle="Manage your working hours & shifts"
        showBack={navigation?.canGoBack?.() || false}
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="time" size={20} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Configure Working Schedule</Text>
              <Text style={styles.infoSubtitle}>
                Clients can only book scheduled appointments during your enabled working hours.
              </Text>
            </View>
          </View>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : (
          <Card style={styles.scheduleCard}>
            <Text style={styles.sectionTitle}>Weekly Schedule</Text>

            {DAYS_OF_WEEK.map((d) => {
              const dayEntry = schedule.find((s) => s.dayOfWeek === d.day) || {
                dayOfWeek: d.day,
                isAvailable: false,
                slots: []
              };
              const slot = dayEntry.slots?.[0] || { startTime: '09:00', endTime: '18:00' };

              return (
                <View key={d.day}>
                  <View style={styles.dayRow}>
                    <View style={styles.dayLeftCol}>
                      <Text style={styles.dayName}>{d.label}</Text>
                      {dayEntry.isAvailable ? (
                        <TouchableOpacity
                          style={styles.timeTag}
                          onPress={() => handleOpenEditSlots(dayEntry)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="create-outline" size={14} color="#A78BFA" />
                          <Text style={styles.timeText}>
                            {slot.startTime} – {slot.endTime}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.offText}>Unavailable / Day Off</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        dayEntry.isAvailable && styles.toggleBtnActive
                      ]}
                      onPress={() => handleToggleDay(d.day)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={dayEntry.isAvailable ? 'checkmark' : 'close'}
                        size={16}
                        color={dayEntry.isAvailable ? colors.white : '#9CA3AF'}
                      />
                      <Text
                        style={[
                          styles.toggleText,
                          dayEntry.isAvailable && styles.toggleTextActive
                        ]}
                      >
                        {dayEntry.isAvailable ? 'Enabled' : 'Off'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                </View>
              );
            })}

            <Button
              title="Save Working Schedule"
              onPress={handleSaveScheduleToBackend}
              loading={saving}
              disabled={saving}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}
      </ScrollView>

      {/* Edit Slot Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Set Hours for {DAYS_OF_WEEK.find((d) => d.day === currentDay)?.label}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Input
                  label="Start Time (HH:mm) *"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                />
              </View>
              <View style={styles.halfCol}>
                <Input
                  label="End Time (HH:mm) *"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="18:00"
                />
              </View>
            </View>

            <Button
              title="Update Hours"
              onPress={handleSaveSlot}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  scroll: {
    padding: spacing.lg
  },
  infoCard: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2F264A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  infoSubtitle: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    marginTop: 2
  },
  scheduleCard: {
    marginBottom: spacing.lg,
    backgroundColor: '#161420',
    borderColor: '#252136'
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    marginBottom: spacing.md
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  dayLeftCol: {
    flex: 1
  },
  dayName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4
  },
  timeText: {
    ...typography.bodySmall,
    color: '#A78BFA',
    fontWeight: '600'
  },
  offText: {
    ...typography.caption,
    color: '#71717A',
    marginTop: 4
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2D2845'
  },
  toggleBtnActive: {
    backgroundColor: '#064E3B',
    borderColor: '#065F46'
  },
  toggleText: {
    ...typography.caption,
    color: '#9CA3AF',
    fontWeight: '700'
  },
  toggleTextActive: {
    color: '#34D399'
  },
  divider: {
    height: 1,
    backgroundColor: '#252136',
    marginVertical: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalContent: {
    backgroundColor: '#161420',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.lg
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  modalTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF'
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  halfCol: {
    flex: 1
  }
});
