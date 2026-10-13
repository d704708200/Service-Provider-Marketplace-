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
        subtitle="Manage rates and service catalog offerings"
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
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Provider Service Catalog</Text>
          <Text style={styles.infoSubtitle}>
            These are customized offerings linked to your account. Global marketplace categories are managed centrally by platform administration.
          </Text>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
                      size={18}
                      color={colors.slate600}
                    />
                    <Text style={styles.toggleBtnText}>
                      {srv.isActive ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenEdit(srv)}
                    style={styles.editBtn}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color={colors.slate400} />
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
                <Ionicons name="close" size={24} color={colors.slate600} />
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
    backgroundColor: colors.background
  },
  scroll: {
    padding: spacing.lg
  },
  infoCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.slate50
  },
  infoTitle: {
    ...typography.titleSmall,
    color: colors.slate800,
    marginBottom: 2
  },
  infoSubtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    lineHeight: 18
  },
  serviceCard: {
    marginBottom: spacing.md
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  serviceName: {
    ...typography.titleSmall,
    color: colors.slate900
  },
  categoryName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2
  },
  serviceDesc: {
    ...typography.bodySmall,
    color: colors.slate600,
    marginVertical: spacing.sm
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.slate100
  },
  priceVal: {
    ...typography.titleMedium,
    color: colors.slate900,
    fontWeight: '700'
  },
  priceType: {
    ...typography.caption,
    color: colors.slate400
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
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.slate100
  },
  toggleBtnText: {
    ...typography.caption,
    color: colors.slate600,
    fontWeight: '600'
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primarySubtle
  },
  editBtnText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700'
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
  emptySub: {
    ...typography.bodySmall,
    color: colors.slate500,
    textAlign: 'center',
    maxWidth: 290
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
