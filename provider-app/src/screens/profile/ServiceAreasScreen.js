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
import { serviceAreaApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ServiceAreasScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State (Add or Edit)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCodesText, setZipCodesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchServiceAreas = useCallback(async () => {
    try {
      const res = await serviceAreaApi.getServiceAreas();
      if (res?.success && Array.isArray(res.data)) {
        setAreas(res.data);
      }
    } catch (err) {
      console.warn('Error loading provider service areas:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServiceAreas();
  }, [fetchServiceAreas]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServiceAreas();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setSelectedAreaId(null);
    setName('');
    setCity('');
    setState('');
    setZipCodesText('');
    setErrorMessage(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (area) => {
    setSelectedAreaId(area._id);
    setName(area.name || '');
    setCity(area.city || '');
    setState(area.state || '');
    setZipCodesText(Array.isArray(area.zipCodes) ? area.zipCodes.join(', ') : '');
    setErrorMessage(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMessage('Area name is required.');
      return;
    }
    if (!city.trim()) {
      setErrorMessage('City is required.');
      return;
    }

    const zipCodes = zipCodesText
      .split(',')
      .map((z) => z.trim())
      .filter((z) => z.length > 0);

    setSaving(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCodes
    };

    try {
      let res;
      if (selectedAreaId) {
        res = await serviceAreaApi.updateServiceArea(selectedAreaId, payload);
      } else {
        res = await serviceAreaApi.addServiceArea(payload);
      }

      if (res?.success) {
        setAreas(res.data || []);
        setModalVisible(false);
        Alert.alert(
          'Success',
          selectedAreaId ? 'Service area updated successfully.' : 'Service area created successfully.'
        );
      }
    } catch (err) {
      setErrorMessage(err.userMessage || err.message || 'Could not save service area.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Remove Service Area', 'Are you sure you want to delete this service zone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await serviceAreaApi.deleteServiceArea(id);
            if (res?.success) {
              setAreas(res.data || []);
            }
          } catch (err) {
            Alert.alert('Error', err.userMessage || 'Could not delete service area.');
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Service Areas"
        subtitle="Operational territories & covered zip codes"
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
        <Card style={styles.cardHeader}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardHeaderTitle}>Assigned Operational Zones</Text>
              <Text style={styles.cardHeaderSub}>
                Bookings from customers within these cities/zip codes will be matched with you.
              </Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={18} color="#A78BFA" />
              <Text style={styles.addBtnText}>Add Area</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : areas && areas.length > 0 ? (
          areas.map((area) => (
            <Card key={area._id} style={styles.areaCard}>
              <View style={styles.areaHeader}>
                <View style={styles.areaTitleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="map-outline" size={16} color="#A78BFA" />
                  </View>
                  <Text style={styles.areaName}>{area.name}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => handleOpenEdit(area)} style={styles.actionBtn}>
                    <Ionicons name="pencil-outline" size={18} color="#A78BFA" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(area._id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.areaCity}>
                {area.city}
                {area.state ? `, ${area.state}` : ''}
              </Text>

              {area.zipCodes && area.zipCodes.length > 0 ? (
                <View style={styles.zipWrap}>
                  <Text style={styles.zipLabel}>Zip Codes:</Text>
                  {area.zipCodes.map((zip, idx) => (
                    <Badge key={idx} label={zip} variant="slate" size="sm" />
                  ))}
                </View>
              ) : (
                <Text style={styles.noZipText}>All zip codes covered across {area.city}</Text>
              )}
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="location-outline" size={40} color="#71717A" />
            <Text style={styles.emptyTitle}>No Service Areas Configured</Text>
            <Text style={styles.emptySubtitle}>
              Define service areas so customers in your coverage zones can find and book your services.
            </Text>
            <Button
              title="Add Your First Service Area"
              onPress={handleOpenAdd}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}
      </ScrollView>

      {/* Add / Edit Area Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedAreaId ? 'Edit Service Area' : 'New Service Area'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Input
              label="Area Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. South Mumbai Metro"
            />

            <Input
              label="City *"
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Mumbai"
            />

            <Input
              label="State"
              value={state}
              onChangeText={setState}
              placeholder="e.g. Maharashtra"
            />

            <Input
              label="Zip Codes (comma separated)"
              value={zipCodesText}
              onChangeText={setZipCodesText}
              placeholder="e.g. 400001, 400002, 400005"
            />

            <Button
              title={selectedAreaId ? 'Save Changes' : 'Create Service Area'}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
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
  cardHeader: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  cardHeaderTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  cardHeaderSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    backgroundColor: '#201A36',
    borderWidth: 1,
    borderColor: '#362E52',
    borderRadius: borderRadius.md
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA'
  },
  areaCard: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136'
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  areaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#201A36',
    alignItems: 'center',
    justifyContent: 'center'
  },
  areaName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  actionBtn: {
    padding: 4
  },
  areaCity: {
    ...typography.bodyMedium,
    color: '#CBD5E1',
    marginBottom: spacing.sm
  },
  zipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  zipLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600'
  },
  noZipText: {
    fontSize: 11,
    color: '#71717A',
    fontStyle: 'italic'
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: '#161420',
    borderColor: '#252136'
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    marginTop: spacing.xs
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 280
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
  errorBox: {
    backgroundColor: '#4C0519',
    borderWidth: 1,
    borderColor: '#991B1B',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: '#F87171'
  }
});
