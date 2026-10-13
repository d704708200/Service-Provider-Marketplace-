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
        showBack
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
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
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.addBtnText}>Add Area</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : areas && areas.length > 0 ? (
          areas.map((area) => (
            <Card key={area._id} style={styles.areaCard}>
              <View style={styles.areaHeader}>
                <View style={styles.areaTitleRow}>
                  <Ionicons name="map-outline" size={20} color={colors.primary} />
                  <Text style={styles.areaName}>{area.name}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => handleOpenEdit(area)} style={styles.actionBtn}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(area._id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.error || '#EF4444'} />
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
            <Ionicons name="location-outline" size={40} color={colors.slate400} />
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
                <Ionicons name="close" size={24} color={colors.slate600} />
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
    backgroundColor: colors.background
  },
  scroll: {
    padding: spacing.lg
  },
  cardHeader: {
    marginBottom: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  cardHeaderTitle: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  cardHeaderSub: {
    ...typography.caption,
    color: colors.slate500,
    marginTop: 2
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySubtle,
    borderRadius: borderRadius.md
  },
  addBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark
  },
  areaCard: {
    marginBottom: spacing.md
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
  areaName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.slate900
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
    color: colors.slate600,
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
    ...typography.caption,
    color: colors.slate500,
    fontWeight: '600'
  },
  noZipText: {
    ...typography.caption,
    color: colors.slate400,
    fontStyle: 'italic'
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: colors.slate800,
    marginTop: spacing.xs
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    textAlign: 'center',
    maxWidth: 280
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
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
    color: colors.slate900
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: '#B91C1C'
  }
});
