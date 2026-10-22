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
  Modal,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerServicesApi, categoryApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProviderServicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit / Add Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState('fixed');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Deletion in progress ID
  const [deletingId, setDeletingId] = useState(null);

  const fetchServicesAndCategories = useCallback(async () => {
    try {
      const [servicesRes, catRes] = await Promise.all([
        providerServicesApi.getServices().catch((err) => {
          console.warn('Error loading provider services:', err.message);
          return null;
        }),
        categoryApi.getPublicCategories().catch((err) => {
          console.warn('Error loading categories:', err.message);
          return null;
        })
      ]);

      if (servicesRes?.success && Array.isArray(servicesRes.data)) {
        setServices(servicesRes.data);
      }

      if (catRes?.success && Array.isArray(catRes.data)) {
        // Only active platform categories
        const activeCats = catRes.data.filter((c) => c.isActive !== false);
        setCategories(activeCats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServicesAndCategories();
  }, [fetchServicesAndCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchServicesAndCategories();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setSelectedServiceId(null);
    setName('');
    setSelectedCategoryId(categories.length > 0 ? categories[0]._id : '');
    setPrice('');
    setPriceType('fixed');
    setDurationMinutes('60');
    setDescription('');
    setImage('');
    setErrorMsg(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (srv) => {
    setIsEditing(true);
    setSelectedServiceId(srv._id);
    setName(srv.name || '');
    const catId = srv.category?._id || srv.category || (categories[0]?._id || '');
    setSelectedCategoryId(catId);
    setPrice(srv.price?.toString() || '');
    setPriceType(srv.priceType || 'fixed');
    setDurationMinutes(srv.estimatedDurationMinutes?.toString() || '60');
    setDescription(srv.description || '');
    setImage(srv.image || '');
    setErrorMsg(null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Service name is required.');
      return;
    }

    if (!selectedCategoryId) {
      setErrorMsg('Please select an active service category.');
      return;
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setErrorMsg('Valid price greater than ₹0 is required.');
      return;
    }

    const numDuration = parseInt(durationMinutes, 10);
    if (isNaN(numDuration) || numDuration < 1) {
      setErrorMsg('Duration must be at least 1 minute.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      name: name.trim(),
      category: selectedCategoryId,
      price: numPrice,
      priceType,
      estimatedDurationMinutes: numDuration,
      description: description.trim(),
      image: image.trim() || null
    };

    try {
      if (isEditing) {
        const res = await providerServicesApi.updateService(selectedServiceId, payload);
        if (res?.success) {
          Alert.alert('Success', 'Service updated successfully.');
          setModalVisible(false);
          fetchServicesAndCategories();
        }
      } else {
        const res = await providerServicesApi.addService(payload);
        if (res?.success) {
          Alert.alert('Success', 'New service offering created.');
          setModalVisible(false);
          fetchServicesAndCategories();
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.userMessage || err.message || 'Could not save service.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (srv) => {
    try {
      const nextStatus = !srv.isActive;
      const res = await providerServicesApi.updateStatus(srv._id, nextStatus);
      if (res?.success) {
        setServices((prev) =>
          prev.map((item) => (item._id === srv._id ? { ...item, isActive: nextStatus } : item))
        );
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.userMessage || err.message || 'Could not toggle service status.';
      Alert.alert('Action Failed', msg);
    }
  };

  const handleDelete = (srv) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${srv.name}"? If this service has existing customer bookings, it cannot be deleted and should be deactivated instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(srv._id);
            try {
              const res = await providerServicesApi.deleteService(srv._id);
              if (res?.success) {
                Alert.alert('Service Deleted', res.message || 'Service deleted successfully.');
                setServices((prev) => prev.filter((item) => item._id !== srv._id));
              }
            } catch (err) {
              const backendMsg = err.response?.data?.error?.message || err.message;
              Alert.alert('Cannot Delete Service', backendMsg);
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const selectedCategoryObj = categories.find((c) => c._id === selectedCategoryId);
  const numPrice = Number(price);
  const numDuration = parseInt(durationMinutes, 10);
  const isValidPreview = !isNaN(numPrice) && numPrice > 0 && !isNaN(numDuration) && numDuration > 0;

  return (
    <View style={styles.container}>
      <Header
        title="My Services"
        subtitle="Custom rates & active service catalog"
        showBack={navigation?.canGoBack?.() || false}
        onBack={() => navigation.goBack()}
        containerStyle={{ paddingTop: insets.top + spacing.xs }}
        rightComponent={
          <TouchableOpacity
            style={styles.headerAddBtn}
            onPress={handleOpenAdd}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.headerAddText}>Add Service</Text>
          </TouchableOpacity>
        }
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
              <Ionicons name="sparkles" size={18} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Self-Service Catalog & Rates</Text>
              <Text style={styles.infoSubtitle}>
                Publish custom services, define durations, and adjust pricing. Your active custom services are listed directly to nearby customers.
              </Text>
            </View>
          </View>
        </Card>

        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : services && services.length > 0 ? (
          services.map((srv) => {
            const bookingCount = srv.bookingCount !== undefined ? srv.bookingCount : 0;
            return (
              <Card key={srv._id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={styles.serviceName}>{srv.name}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.categoryName}>
                        {srv.category?.name || 'General Category'}
                      </Text>
                      <Text style={styles.metaDot}>•</Text>
                      <View style={styles.durationPill}>
                        <Ionicons name="time-outline" size={12} color="#A1A1AA" />
                        <Text style={styles.durationText}>
                          {srv.estimatedDurationMinutes || 60} mins
                        </Text>
                      </View>
                    </View>
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

                {/* Booking Count & Price */}
                <View style={styles.statsRow}>
                  <View style={styles.bookingCountBadge}>
                    <Ionicons name="calendar-outline" size={13} color="#9CA3AF" />
                    <Text style={styles.bookingCountText}>
                      {bookingCount} {bookingCount === 1 ? 'Booking' : 'Bookings'}
                    </Text>
                  </View>

                  <View style={styles.priceContainer}>
                    <Text style={styles.priceVal}>₹{srv.price}</Text>
                    <Text style={styles.priceType}>/ {srv.priceType || 'fixed'}</Text>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.priceRow}>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      onPress={() => handleToggleStatus(srv)}
                      style={[styles.toggleBtn, srv.isActive && styles.toggleBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={srv.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={15}
                        color={srv.isActive ? '#F59E0B' : '#10B981'}
                      />
                      <Text style={[styles.toggleBtnText, srv.isActive ? { color: '#F59E0B' } : { color: '#10B981' }]}>
                        {srv.isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenEdit(srv)}
                      style={styles.editBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="create-outline" size={15} color="#A78BFA" />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(srv)}
                      style={styles.deleteBtn}
                      activeOpacity={0.7}
                      disabled={deletingId === srv._id}
                    >
                      {deletingId === srv._id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={15} color="#EF4444" />
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={44} color="#71717A" />
            <Text style={styles.emptyTitle}>No Custom Services Yet</Text>
            <Text style={styles.emptySub}>
              Start offering your specialized services with customized rates and turnaround times to attract local customers.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={handleOpenAdd}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyAddBtnText}>Add Your First Service</Text>
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>

      {/* Add / Edit Service Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isEditing ? 'Edit Service Offering' : 'Add New Service'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isEditing ? 'Update your rates & service details' : 'Configure custom offering & pricing'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#F87171" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Input
                label="Service Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Premium Deep Cleaning"
              />

              {/* Category Selection */}
              <Text style={styles.inputLabel}>Category *</Text>
              {categories.length === 0 ? (
                <Text style={styles.noCategoriesText}>No active categories found</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipsScroll}>
                  {categories.map((c) => {
                    const isSelected = c._id === selectedCategoryId;
                    return (
                      <TouchableOpacity
                        key={c._id}
                        onPress={() => setSelectedCategoryId(c._id)}
                        style={[styles.catChip, isSelected && styles.catChipSelected]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.catChipText, isSelected && styles.catChipTextSelected]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Price & Duration Grid */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Input
                    label="Price in INR (₹) *"
                    value={price}
                    onChangeText={setPrice}
                    placeholder="e.g. 499"
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Input
                    label="Duration (minutes) *"
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    placeholder="e.g. 60"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Pricing Type Selector */}
              <Text style={styles.inputLabel}>Pricing Model</Text>
              <View style={styles.pricingTypeRow}>
                {['fixed', 'hourly'].map((type) => {
                  const isSelected = priceType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.pricingTypeBtn, isSelected && styles.pricingTypeBtnSelected]}
                      onPress={() => setPriceType(type)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={type === 'fixed' ? 'pricetag-outline' : 'speedometer-outline'}
                        size={15}
                        color={isSelected ? '#A78BFA' : '#71717A'}
                      />
                      <Text style={[styles.pricingTypeText, isSelected && styles.pricingTypeTextSelected]}>
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Input
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="What is included in this service..."
                multiline
                numberOfLines={3}
              />

              {/* Price Preview Banner */}
              <View style={styles.previewCard}>
                <Ionicons name="eye-outline" size={18} color="#A78BFA" />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.previewLabel}>Customer Preview</Text>
                  <Text style={styles.previewValue}>
                    {isValidPreview
                      ? `₹${numPrice} for ${numDuration} minutes (${priceType})`
                      : 'Enter price and duration to preview'}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionButtons}>
              <Button
                title={isEditing ? 'Save Changes' : 'Publish Service'}
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                style={{ flex: 1 }}
              />
            </View>
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
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10
  },
  headerAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
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
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    justifyContent: 'center',
    alignItems: 'center'
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6
  },
  categoryName: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600'
  },
  metaDot: {
    color: '#4B5563',
    fontSize: 10
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  durationText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  serviceDesc: {
    ...typography.bodySmall,
    color: '#CBD5E1',
    marginVertical: spacing.sm
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs
  },
  bookingCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1C1929',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2D2845'
  },
  bookingCountText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500'
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
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
  priceRow: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#252136'
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2D2845'
  },
  toggleBtnActive: {
    borderColor: 'rgba(245, 158, 11, 0.4)'
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600'
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#241F36',
    borderWidth: 1,
    borderColor: '#36314D'
  },
  editBtnText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '700'
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)'
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700'
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: '#161420',
    borderColor: '#252136',
    marginTop: spacing.md
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
    maxWidth: 300,
    lineHeight: 20
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: spacing.sm
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  modalContent: {
    backgroundColor: '#161420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.lg,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  modalTitle: {
    ...typography.titleMedium,
    color: '#FFFFFF'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4C0519',
    borderWidth: 1,
    borderColor: '#991B1B',
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.md
  },
  errorText: {
    ...typography.bodySmall,
    color: '#F87171',
    flex: 1
  },
  inputLabel: {
    fontSize: 12,
    color: '#D1D5DB',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: spacing.xs
  },
  catChipsScroll: {
    flexDirection: 'row',
    marginBottom: spacing.md
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2E2947',
    marginRight: 8
  },
  catChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6'
  },
  catChipText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  catChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  noCategoriesText: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: spacing.md
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  pricingTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  pricingTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#1C1929',
    borderWidth: 1,
    borderColor: '#2D2845',
    borderRadius: 10
  },
  pricingTypeBtnSelected: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.15)'
  },
  pricingTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A'
  },
  pricingTypeTextSelected: {
    color: '#A78BFA',
    fontWeight: '700'
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm
  },
  previewLabel: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  previewValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2
  },
  modalActionButtons: {
    flexDirection: 'row',
    marginTop: spacing.md
  }
});
