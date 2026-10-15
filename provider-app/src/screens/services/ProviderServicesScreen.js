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
import { providerServicesApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProviderServicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit / Add Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('fixed');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchServices = useCallback(async () => {
    try {
      const res = await providerServicesApi.getServices();
      if (res?.success && Array.isArray(res.data)) {
        setServices(res.data);
      }
    } catch (err) {
      console.warn('Error loading provider services:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServices();
    setRefreshing(false);
  };

  const handleOpenEdit = (srv) => {
    setSelectedServiceId(srv._id);
    setName(srv.name || '');
    setPrice(srv.price?.toString() || '');
    setPriceType(srv.priceType || 'fixed');
    setDescription(srv.description || '');
    setErrorMsg(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Service name is required.');
      return;
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg('Valid price greater than 0 is required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      name: name.trim(),
      price: numPrice,
      priceType,
      description: description.trim()
    };

    try {
      const res = await providerServicesApi.updateService(selectedServiceId, payload);
      if (res?.success) {
        Alert.alert('Success', 'Service updated successfully.');
        setModalVisible(false);
        fetchServices();
      }
    } catch (err) {
      setErrorMsg(err.userMessage || err.message || 'Could not update service.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (srv) => {
    try {
      const res = await providerServicesApi.updateService(srv._id, {
        isActive: !srv.isActive
      });
      if (res?.success) {
        setServices((prev) =>
          prev.map((item) => (item._id === srv._id ? { ...item, isActive: !item.isActive } : item))
        );
      }
    } catch (err) {
      Alert.alert('Error', err.userMessage || 'Could not toggle service status.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Offered Services"
        subtitle="Custom rates & active service catalog"
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
          <Text style={styles.infoTitle}>Provider Service Catalog</Text>
          <Text style={styles.infoSubtitle}>
            These are customized offerings linked to your account. Global marketplace categories are managed centrally by platform administration.
          </Text>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : services && services.length > 0 ? (
          services.map((srv) => (
            <Card key={srv._id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.serviceName}>{srv.name}</Text>
                  <Text style={styles.categoryName}>
                    {srv.category?.name || 'General Category'}
                  </Text>
                </View>

                <Badge
                  label={srv.isActive ? 'ACTIVE' : 'INACTIVE'}
                  variant={srv.isActive ? 'success' : 'slate'}
                  size="sm"
                />
              </View>

              <Text style={styles.serviceDesc} numberOfLines={2}>
                {srv.description || 'No custom description set.'}
              </Text>

              <View style={styles.priceRow}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={styles.priceVal}>₹{srv.price}</Text>
                  <Text style={styles.priceType}>/ {srv.priceType}</Text>
                </View>

                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    onPress={() => handleToggleStatus(srv)}
                    style={styles.toggleBtn}
                  >
                    <Ionicons
                      name={srv.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={16}
                      color="#9CA3AF"
                    />
                    <Text style={styles.toggleBtnText}>
                      {srv.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenEdit(srv)}
                    style={styles.editBtn}
                  >
                    <Ionicons name="create-outline" size={15} color="#A78BFA" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color="#71717A" />
            <Text style={styles.emptyTitle}>No Custom Services Yet</Text>
            <Text style={styles.emptySub}>
              You are currently eligible to receive platform service requests for your approved categories.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Edit Service Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Service Offering</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Input
              label="Service Name *"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Premium Deep Cleaning"
            />

            <Input
              label="Base Price (₹) *"
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 799"
              keyboardType="numeric"
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Service details and scope..."
              multiline
              numberOfLines={3}
            />

            <Button
              title="Save Changes"
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
  infoCard: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136',
    borderWidth: 1
  },
  infoTitle: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    marginBottom: 2
  },
  infoSubtitle: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    lineHeight: 18
  },
  serviceCard: {
    marginBottom: spacing.md,
    backgroundColor: '#161420',
    borderColor: '#252136'
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  serviceName: {
    ...typography.titleSmall,
    color: '#FFFFFF'
  },
  categoryName: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '600',
    marginTop: 2
  },
  serviceDesc: {
    ...typography.bodySmall,
    color: '#CBD5E1',
    marginVertical: spacing.sm
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#252136'
  },
  priceVal: {
    ...typography.titleMedium,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  priceType: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2D2845'
  },
  toggleBtnText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600'
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#241F36',
    borderWidth: 1,
    borderColor: '#36314D'
  },
  editBtnText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '700'
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
  emptySub: {
    ...typography.bodySmall,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 290
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
