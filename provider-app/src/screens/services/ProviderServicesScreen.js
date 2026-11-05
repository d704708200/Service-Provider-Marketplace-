import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Platform,
  TextInput,
  Switch
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { providerTagApi, providerServicesApi, categoryApi } from '../../services/api';
import { Header, Card, Badge, Button, Input } from '../../components/common';
import colors from '../../theme/colors';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProviderServicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  // Active top tab: 'tags' (Marketplace Service Tags) vs 'legacy' (Custom Services)
  const [activeTab, setActiveTab] = useState('tags');

  // Loading and refreshing
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Dynamic Tags Catalog & Selected State
  const [catalog, setCatalog] = useState([]);
  const [selectedTagMap, setSelectedTagMap] = useState({}); // { [tagId]: { tagId, isActive, basePrice, pricingType, approvalStatus } }
  const [originalTagMap, setOriginalTagMap] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('ALL');

  // Tag Rate Config Modal
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [modalBasePrice, setModalBasePrice] = useState('500');
  const [modalPricingType, setModalPricingType] = useState('fixed');

  // Legacy Services State & Modal
  const [legacyServices, setLegacyServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [legacyModalVisible, setLegacyModalVisible] = useState(false);
  const [isEditingLegacy, setIsEditingLegacy] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [legacyName, setLegacyName] = useState('');
  const [legacyCategoryId, setLegacyCategoryId] = useState('');
  const [legacyPrice, setLegacyPrice] = useState('');
  const [legacyPriceType, setLegacyPriceType] = useState('fixed');
  const [legacyDuration, setLegacyDuration] = useState('60');
  const [legacyDescription, setLegacyDescription] = useState('');
  const [legacySaving, setLegacySaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch full dynamic service tags & legacy services
  const loadData = useCallback(async () => {
    try {
      const [tagRes, catRes] = await Promise.all([
        providerTagApi.getMyServicesAndTags().catch((err) => {
          console.warn('Error fetching provider service tags:', err.message);
          return null;
        }),
        categoryApi.getPublicCategories().catch((err) => {
          console.warn('Error fetching public categories:', err.message);
          return null;
        })
      ]);

      if (tagRes?.success && tagRes.data) {
        const rawCatalog = tagRes.data.catalog || [];
        setCatalog(rawCatalog);

        // Build selected map
        const selMap = {};
        if (Array.isArray(tagRes.data.selectedTags)) {
          tagRes.data.selectedTags.forEach((item) => {
            selMap[String(item.tagId)] = {
              tagId: String(item.tagId),
              isActive: item.isActive !== false,
              basePrice: item.basePrice || 0,
              pricingType: item.pricingType || 'fixed',
              approvalStatus: item.approvalStatus || 'approved'
            };
          });
        }
        setSelectedTagMap(selMap);
        setOriginalTagMap(selMap);

        // Default open first 3 categories
        const openState = {};
        rawCatalog.slice(0, 3).forEach((item) => {
          if (item?.category?._id) openState[String(item.category._id)] = true;
        });
        setExpandedCategories(openState);

        // Legacy services
        if (Array.isArray(tagRes.data.legacyServices)) {
          setLegacyServices(tagRes.data.legacyServices);
        }
      }

      if (catRes?.success && Array.isArray(catRes.data)) {
        setCategories(catRes.data.filter((c) => c.isActive !== false));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Check if tags have unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const curKeys = Object.keys(selectedTagMap).sort();
    const origKeys = Object.keys(originalTagMap).sort();
    if (curKeys.length !== origKeys.length) return true;
    for (const key of curKeys) {
      if (!originalTagMap[key]) return true;
      const c = selectedTagMap[key];
      const o = originalTagMap[key];
      if (c.isActive !== o.isActive || c.basePrice !== o.basePrice || c.pricingType !== o.pricingType) {
        return true;
      }
    }
    return false;
  }, [selectedTagMap, originalTagMap]);

  // Tag selection toggle
  const handleToggleSelectTag = (tag) => {
    const tagId = String(tag._id);
    setSelectedTagMap((prev) => {
      const next = { ...prev };
      if (next[tagId]) {
        delete next[tagId];
      } else {
        next[tagId] = {
          tagId,
          isActive: true,
          basePrice: tag.basePrice || 500,
          pricingType: tag.pricingType || 'fixed',
          approvalStatus: 'approved'
        };
      }
      return next;
    });
    setSaveSuccessMsg(null);
  };

  // Toggle active/inactive for an individual selected tag
  const handleToggleTagStatus = async (tagId) => {
    const current = selectedTagMap[tagId];
    if (!current) return;

    const newActive = !current.isActive;

    // Optimistic local update
    setSelectedTagMap((prev) => ({
      ...prev,
      [tagId]: { ...prev[tagId], isActive: newActive }
    }));

    // If tag is already saved on server, call server PATCH directly
    if (originalTagMap[tagId]) {
      try {
        await providerTagApi.toggleTagStatus(tagId, newActive);
        setOriginalTagMap((prev) => ({
          ...prev,
          [tagId]: { ...prev[tagId], isActive: newActive }
        }));
      } catch (err) {
        // Revert on failure
        setSelectedTagMap((prev) => ({
          ...prev,
          [tagId]: { ...prev[tagId], isActive: !newActive }
        }));
        Alert.alert('Status Update Failed', err.userMessage || 'Could not update tag status.');
      }
    }
  };

  // Open Rate configuration modal for a tag
  const handleOpenRateModal = (tag) => {
    const tagId = String(tag._id);
    const existing = selectedTagMap[tagId];
    setEditingTag(tag);
    setModalBasePrice(existing?.basePrice ? String(existing.basePrice) : '500');
    setModalPricingType(existing?.pricingType || 'fixed');
    setRateModalVisible(true);
  };

  // Save rate configuration
  const handleSaveRateConfig = () => {
    if (!editingTag) return;
    const tagId = String(editingTag._id);
    const parsedPrice = parseFloat(modalBasePrice) || 0;

    setSelectedTagMap((prev) => ({
      ...prev,
      [tagId]: {
        ...(prev[tagId] || { tagId, isActive: true, approvalStatus: 'approved' }),
        basePrice: parsedPrice,
        pricingType: modalPricingType
      }
    }));

    setRateModalVisible(false);
    setEditingTag(null);
  };

  // Save all selected tags to backend
  const handleSaveAllTags = async () => {
    const tagEntries = Object.values(selectedTagMap);
    if (tagEntries.length === 0) {
      Alert.alert(
        'No Tags Selected',
        'Please select at least one service tag that you are certified and equipped to perform.'
      );
      return;
    }

    setSavingTags(true);
    setSaveSuccessMsg(null);
    try {
      const payload = {
        tags: tagEntries.map((t) => ({
          tagId: t.tagId,
          isActive: t.isActive,
          basePrice: t.basePrice,
          pricingType: t.pricingType
        }))
      };

      const res = await providerTagApi.updateMyTags(payload);
      if (res.success) {
        setOriginalTagMap({ ...selectedTagMap });
        setSaveSuccessMsg('Services updated! Customers can now find you for these tags.');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      Alert.alert('Save Failed', err.userMessage || 'Could not update your service tags.');
    } finally {
      setSavingTags(false);
    }
  };

  // Toggle category accordion
  const handleToggleCategoryAccordion = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Filtered catalog by search and category filter
  const filteredCatalog = useMemo(() => {
    let result = catalog;

    if (selectedFilterCategory !== 'ALL') {
      result = result.filter(
        (c) => String(c?.category?._id) === selectedFilterCategory
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result
        .map((catGroup) => {
          const matchingSubs = catGroup.subcategories
            .map((sub) => {
              const matchingTags = sub.tags.filter(
                (t) =>
                  t.name.toLowerCase().includes(q) ||
                  (t.description && t.description.toLowerCase().includes(q)) ||
                  sub.name.toLowerCase().includes(q)
              );
              return { ...sub, tags: matchingTags };
            })
            .filter((sub) => sub.tags.length > 0);

          return { ...catGroup, subcategories: matchingSubs };
        })
        .filter((catGroup) => catGroup.subcategories.length > 0);
    }

    return result;
  }, [catalog, selectedFilterCategory, searchQuery]);

  // Metrics summary
  const totalSelectedTags = Object.keys(selectedTagMap).length;
  const activeSelectedTags = Object.values(selectedTagMap).filter((t) => t.isActive).length;

  // --- Legacy Custom Services Handlers ---
  const handleOpenAddLegacy = () => {
    setIsEditingLegacy(false);
    setSelectedServiceId(null);
    setLegacyName('');
    setLegacyCategoryId(categories.length > 0 ? categories[0]._id : '');
    setLegacyPrice('');
    setLegacyPriceType('fixed');
    setLegacyDuration('60');
    setLegacyDescription('');
    setLegacyModalVisible(true);
  };

  const handleOpenEditLegacy = (srv) => {
    setIsEditingLegacy(true);
    setSelectedServiceId(srv._id);
    setLegacyName(srv.name || '');
    setLegacyCategoryId(srv.category?._id || srv.category || '');
    setLegacyPrice(String(srv.price || ''));
    setLegacyPriceType(srv.priceType || 'fixed');
    setLegacyDuration(String(srv.durationMinutes || '60'));
    setLegacyDescription(srv.description || '');
    setLegacyModalVisible(true);
  };

  const handleSaveLegacy = async () => {
    if (!legacyName.trim()) {
      Alert.alert('Validation Error', 'Service name is required.');
      return;
    }
    const numPrice = parseFloat(legacyPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      Alert.alert('Validation Error', 'Enter a valid service price.');
      return;
    }

    setLegacySaving(true);
    try {
      const payload = {
        name: legacyName.trim(),
        category: legacyCategoryId,
        price: numPrice,
        priceType: legacyPriceType,
        durationMinutes: parseInt(legacyDuration, 10) || 60,
        description: legacyDescription.trim()
      };

      if (isEditingLegacy && selectedServiceId) {
        await providerServicesApi.updateService(selectedServiceId, payload);
      } else {
        await providerServicesApi.addService(payload);
      }
      setLegacyModalVisible(false);
      await loadData();
    } catch (err) {
      Alert.alert('Save Failed', err.userMessage || 'Could not save custom service.');
    } finally {
      setLegacySaving(false);
    }
  };

  const handleDeleteLegacy = (srv) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${srv.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(srv._id);
            try {
              await providerServicesApi.deleteService(srv._id);
              await loadData();
            } catch (err) {
              Alert.alert('Delete Failed', err.userMessage || 'Could not delete service.');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title="My Services & Tags"
        showBack
        onBack={() => navigation.goBack()}
        rightIcon={activeTab === 'legacy' ? 'add' : null}
        onRightPress={activeTab === 'legacy' ? handleOpenAddLegacy : null}
      />

      {/* Main Tabs Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'tags' && styles.tabButtonActive]}
          onPress={() => setActiveTab('tags')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="pricetags"
            size={16}
            color={activeTab === 'tags' ? colors.primaryLight : '#71717A'}
          />
          <Text style={[styles.tabText, activeTab === 'tags' && styles.tabTextActive]}>
            Service Tags ({totalSelectedTags})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'legacy' && styles.tabButtonActive]}
          onPress={() => setActiveTab('legacy')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="briefcase"
            size={16}
            color={activeTab === 'legacy' ? colors.primaryLight : '#71717A'}
          />
          <Text style={[styles.tabText, activeTab === 'legacy' && styles.tabTextActive]}>
            Custom Services ({legacyServices.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading service catalog...</Text>
        </View>
      ) : activeTab === 'tags' ? (
        // DYNAMIC SERVICE TAGS TAB
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {/* Summary KPI Banner */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryKpi}>
                  <Text style={styles.summaryKpiValue}>{activeSelectedTags}</Text>
                  <Text style={styles.summaryKpiLabel}>Active Tags</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryKpi}>
                  <Text style={styles.summaryKpiValue}>{totalSelectedTags}</Text>
                  <Text style={styles.summaryKpiLabel}>Total Selected</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryKpi}>
                  <Text style={[styles.summaryKpiValue, { color: colors.successLight }]}>Live</Text>
                  <Text style={styles.summaryKpiLabel}>Matching Status</Text>
                </View>
              </View>
              <View style={styles.guidanceBox}>
                <Ionicons name="information-circle-outline" size={16} color="#A78BFA" />
                <Text style={styles.guidanceText}>
                  Select only the specific services you provide. Customers discover you when searching these exact tags.
                </Text>
              </View>
            </View>

            {/* Success Banner */}
            {saveSuccessMsg && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successBannerText}>{saveSuccessMsg}</Text>
              </View>
            )}

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#71717A" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search service tags (e.g., Oil Change, Repair)..."
                placeholderTextColor="#71717A"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color="#71717A" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Chips */}
            <ScrollView showsVerticalScrollIndicator={false}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipsContainer}
            >
              <TouchableOpacity
                style={[styles.categoryFilterChip, selectedFilterCategory === 'ALL' && styles.categoryFilterChipActive]}
                onPress={() => setSelectedFilterCategory('ALL')}
              >
                <Text style={[styles.categoryFilterChipText, selectedFilterCategory === 'ALL' && styles.categoryFilterChipTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {catalog.map((catGroup) => {
                const catId = String(catGroup?.category?._id);
                const isActiveFilter = selectedFilterCategory === catId;
                return (
                  <TouchableOpacity
                    key={catId}
                    style={[styles.categoryFilterChip, isActiveFilter && styles.categoryFilterChipActive]}
                    onPress={() => setSelectedFilterCategory(catId)}
                  >
                    <Text style={[styles.categoryFilterChipText, isActiveFilter && styles.categoryFilterChipTextActive]}>
                      {catGroup.category?.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Catalog Grouped by Category & Subcategory */}
            {filteredCatalog.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Ionicons name="search-outline" size={48} color="#4B5563" />
                <Text style={styles.emptyStateTitle}>No matching tags found</Text>
                <Text style={styles.emptyStateSub}>Try clearing your search query or choosing another category filter.</Text>
              </View>
            ) : (
              filteredCatalog.map((catGroup) => {
                const catId = String(catGroup.category?._id);
                const isExpanded = expandedCategories[catId] !== false; // Default true or explicit

                // Count selected in this category
                let selectedInCat = 0;
                let totalInCat = 0;
                catGroup.subcategories.forEach((sub) => {
                  sub.tags.forEach((t) => {
                    totalInCat++;
                    if (selectedTagMap[String(t._id)]) selectedInCat++;
                  });
                });

                return (
                  <View key={catId} style={styles.categoryCard}>
                    {/* Category Header Accordion */}
                    <TouchableOpacity
                      style={styles.categoryCardHeader}
                      onPress={() => handleToggleCategoryAccordion(catId)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.categoryHeaderLeft}>
                        <View style={styles.categoryIconCircle}>
                          <Ionicons name="layers-outline" size={18} color="#A78BFA" />
                        </View>
                        <View>
                          <Text style={styles.categoryTitle}>{catGroup.category?.name}</Text>
                          <Text style={styles.categorySubtitle}>
                            {selectedInCat} of {totalInCat} tags selected
                          </Text>
                        </View>
                      </View>
                      <View style={styles.categoryHeaderRight}>
                        {selectedInCat > 0 && (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>{selectedInCat} Active</Text>
                          </View>
                        )}
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Subcategories & Tags list */}
                    {isExpanded && (
                      <View style={styles.categoryCardBody}>
                        {catGroup.subcategories.map((sub, subIdx) => (
                          <View key={sub.name + subIdx} style={styles.subcategorySection}>
                            <View style={styles.subcategoryHeader}>
                              <View style={styles.subcategoryDot} />
                              <Text style={styles.subcategoryTitle}>{sub.name}</Text>
                              <Text style={styles.subcategoryCount}>({sub.tags.length})</Text>
                            </View>

                            {/* Tags Grid / List */}
                            <View style={styles.tagsContainer}>
                              {sub.tags.map((tag) => {
                                const tagId = String(tag._id);
                                const isSelected = Boolean(selectedTagMap[tagId]);
                                const config = selectedTagMap[tagId];
                                const isTagActive = config ? config.isActive : false;

                                return (
                                  <View
                                    key={tagId}
                                    style={[
                                      styles.tagItemCard,
                                      isSelected && styles.tagItemCardSelected
                                    ]}
                                  >
                                    <TouchableOpacity
                                      style={styles.tagItemMain}
                                      onPress={() => handleToggleSelectTag(tag)}
                                      activeOpacity={0.7}
                                    >
                                      {/* Checkbox indicator */}
                                      <View
                                        style={[
                                          styles.checkbox,
                                          isSelected && styles.checkboxSelected
                                        ]}
                                      >
                                        {isSelected && (
                                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                                        )}
                                      </View>

                                      {/* Tag Name & Info */}
                                      <View style={styles.tagItemInfo}>
                                        <View style={styles.tagNameRow}>
                                          <Text
                                            style={[
                                              styles.tagNameText,
                                              isSelected && styles.tagNameTextSelected
                                            ]}
                                          >
                                            {tag.name}
                                          </Text>
                                        </View>
                                        {tag.description ? (
                                          <Text style={styles.tagDescText} numberOfLines={2}>
                                            {tag.description}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </TouchableOpacity>

                                    {/* Action Bar for Selected Tag: Price & Active Switch */}
                                    {isSelected && (
                                      <View style={styles.tagActionBar}>
                                        {/* Rate Setting Button */}
                                        <TouchableOpacity
                                          style={styles.rateBadge}
                                          onPress={() => handleOpenRateModal(tag)}
                                          activeOpacity={0.7}
                                        >
                                          <Ionicons name="pricetag-outline" size={13} color="#A78BFA" />
                                          <Text style={styles.rateBadgeText}>
                                            ₹{config.basePrice || 500} ({config.pricingType || 'fixed'})
                                          </Text>
                                          <Ionicons name="pencil" size={11} color="#A78BFA" />
                                        </TouchableOpacity>

                                        {/* Availability Active Switch */}
                                        <View style={styles.switchRow}>
                                          <Text
                                            style={[
                                              styles.switchLabel,
                                              { color: isTagActive ? '#10B981' : '#6B7280' }
                                            ]}
                                          >
                                            {isTagActive ? 'Active' : 'Paused'}
                                          </Text>
                                          <Switch
                                            value={isTagActive}
                                            onValueChange={() => handleToggleTagStatus(tagId)}
                                            trackColor={{ false: '#374151', true: '#7C3AED' }}
                                            thumbColor={isTagActive ? '#FFFFFF' : '#9CA3AF'}
                                            style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] } : {}}
                                          />
                                        </View>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom Docked Save Changes Button */}
          <View style={[styles.bottomSaveBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.bottomSaveBarLeft}>
              <Text style={styles.bottomSaveCount}>
                {totalSelectedTags} Tag{totalSelectedTags === 1 ? '' : 's'} Selected
              </Text>
              <Text style={styles.bottomSaveSub}>
                {hasUnsavedChanges ? 'Unsaved modifications pending' : 'All changes saved to live profile'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!hasUnsavedChanges || savingTags) && styles.saveButtonDisabled
              ]}
              onPress={handleSaveAllTags}
              disabled={!hasUnsavedChanges || savingTags}
              activeOpacity={0.8}
            >
              {savingTags ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // LEGACY CUSTOM SERVICES TAB
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.legacyHeaderBar}>
            <View>
              <Text style={styles.legacyHeaderTitle}>Custom Service Offerings</Text>
              <Text style={styles.legacyHeaderSub}>
                Self-defined rate cards and specialty packages
              </Text>
            </View>
            <TouchableOpacity style={styles.legacyAddBtn} onPress={handleOpenAddLegacy}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.legacyAddBtnText}>Add Service</Text>
            </TouchableOpacity>
          </View>

          {legacyServices.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#4B5563" />
              <Text style={styles.emptyStateTitle}>No custom services yet</Text>
              <Text style={styles.emptyStateSub}>
                Add custom offerings or configure dynamic service tags above.
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenAddLegacy}>
                <Text style={styles.emptyAddBtnText}>Create Custom Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            legacyServices.map((srv) => (
              <View key={srv._id} style={styles.legacyServiceCard}>
                <View style={styles.legacyServiceTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.legacyServiceName}>{srv.name}</Text>
                    <Text style={styles.legacyServiceCat}>
                      {srv.category?.name || 'General Service'} • {srv.durationMinutes || 60} mins
                    </Text>
                  </View>
                  <Text style={styles.legacyServicePrice}>₹{srv.price}</Text>
                </View>

                {srv.description ? (
                  <Text style={styles.legacyServiceDesc} numberOfLines={2}>
                    {srv.description}
                  </Text>
                ) : null}

                <View style={styles.legacyServiceBottom}>
                  <Badge
                    variant={srv.isActive !== false ? 'success' : 'neutral'}
                    size="sm"
                  >
                    {srv.isActive !== false ? 'Active' : 'Inactive'}
                  </Badge>

                  <View style={styles.legacyActions}>
                    <TouchableOpacity
                      style={styles.legacyActionBtn}
                      onPress={() => handleOpenEditLegacy(srv)}
                    >
                      <Ionicons name="pencil" size={16} color="#A78BFA" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.legacyActionBtn}
                      onPress={() => handleDeleteLegacy(srv)}
                    >
                      {deletingId === srv._id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* MODAL: Configure Tag Base Price & Rate Type */}
      <Modal
        visible={rateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.rateModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Set Rate for Tag</Text>
                <Text style={styles.modalSub}>{editingTag?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setRateModalVisible(false)}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInputLabel}>Base Starting Price (₹)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor="#71717A"
              value={modalBasePrice}
              onChangeText={setModalBasePrice}
            />

            <Text style={styles.modalInputLabel}>Pricing Type</Text>
            <View style={styles.pricingTypeRow}>
              {['fixed', 'hourly'].map((pt) => (
                <TouchableOpacity
                  key={pt}
                  style={[
                    styles.pricingTypeBtn,
                    modalPricingType === pt && styles.pricingTypeBtnSelected
                  ]}
                  onPress={() => setModalPricingType(pt)}
                >
                  <Text
                    style={[
                      styles.pricingTypeBtnText,
                      modalPricingType === pt && styles.pricingTypeBtnTextSelected
                    ]}
                  >
                    {pt === 'fixed' ? 'Fixed Price' : 'Hourly Rate'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setRateModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Save Rate"
                variant="primary"
                onPress={handleSaveRateConfig}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Create / Edit Legacy Service */}
      <Modal
        visible={legacyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLegacyModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.legacyModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditingLegacy ? 'Edit Custom Service' : 'Add Custom Service'}
              </Text>
              <TouchableOpacity onPress={() => setLegacyModalVisible(false)}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalInputLabel}>Service Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Premium Bike Detailing"
                placeholderTextColor="#71717A"
                value={legacyName}
                onChangeText={setLegacyName}
              />

              <Text style={styles.modalInputLabel}>Category</Text>
              <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c._id}
                    style={[
                      styles.catChip,
                      legacyCategoryId === c._id && styles.catChipSelected
                    ]}
                    onPress={() => setLegacyCategoryId(c._id)}
                  >
                    <Text
                      style={[
                        styles.catChipText,
                        legacyCategoryId === c._id && styles.catChipTextSelected
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalInputLabel}>Price (₹)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="750"
                placeholderTextColor="#71717A"
                value={legacyPrice}
                onChangeText={setLegacyPrice}
              />

              <Text style={styles.modalInputLabel}>Estimated Duration (Minutes)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor="#71717A"
                value={legacyDuration}
                onChangeText={setLegacyDuration}
              />

              <Text style={styles.modalInputLabel}>Description</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                multiline
                placeholder="Detail what is included in this service..."
                placeholderTextColor="#71717A"
                value={legacyDescription}
                onChangeText={setLegacyDescription}
              />

              <View style={styles.modalActionButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setLegacyModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={legacySaving ? 'Saving...' : 'Save Service'}
                  variant="primary"
                  onPress={handleSaveLegacy}
                  disabled={legacySaving}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ScrollView>
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#12111A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1B2E',
    gap: spacing.sm
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#161420'
  },
  tabButtonActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderWidth: 1,
    borderColor: '#7C3AED'
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A'
  },
  tabTextActive: {
    color: '#A78BFA',
    fontWeight: '700'
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  loadingText: {
    marginTop: spacing.md,
    color: '#9CA3AF',
    fontSize: 14
  },
  contentScroll: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.md
  },
  summaryCard: {
    backgroundColor: '#161420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.md,
    marginBottom: spacing.md
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#221E33'
  },
  summaryKpi: {
    flex: 1,
    alignItems: 'center'
  },
  summaryKpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  summaryKpiLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2A253D'
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.sm,
    paddingTop: 4
  },
  guidanceText: {
    flex: 1,
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 16
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: spacing.md
  },
  successBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#262238',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.sm
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13
  },
  categoryChipsContainer: {
    paddingVertical: 6,
    gap: 8,
    marginBottom: spacing.md
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#161420',
    borderWidth: 1,
    borderColor: '#252136'
  },
  categoryFilterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6'
  },
  categoryFilterChipText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  categoryFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.lg
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18
  },
  categoryCard: {
    backgroundColor: '#161420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252136',
    marginBottom: spacing.md,
    overflow: 'hidden'
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: '#1A1726'
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  categorySubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  activePillText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600'
  },
  categoryCardBody: {
    padding: spacing.md,
    backgroundColor: '#13111C'
  },
  subcategorySection: {
    marginBottom: spacing.md
  },
  subcategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm
  },
  subcategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5CF6'
  },
  subcategoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  subcategoryCount: {
    fontSize: 11,
    color: '#71717A'
  },
  tagsContainer: {
    gap: 8
  },
  tagItemCard: {
    backgroundColor: '#191624',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262238',
    padding: spacing.sm,
    transition: 'all 0.2s'
  },
  tagItemCardSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#1F1B2E'
  },
  tagItemMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  tagItemInfo: {
    flex: 1
  },
  tagNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tagNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1'
  },
  tagNameTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  tagDescText: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
    lineHeight: 15
  },
  tagActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2B263E'
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)'
  },
  rateBadgeText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '600'
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: '600'
  },
  bottomSaveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12111A',
    borderTopWidth: 1,
    borderTopColor: '#221E33',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bottomSaveBarLeft: {
    flex: 1,
    marginRight: spacing.md
  },
  bottomSaveCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  bottomSaveSub: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  saveButtonDisabled: {
    backgroundColor: '#2D2845',
    opacity: 0.6
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  // Legacy Services Styles
  legacyHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md
  },
  legacyHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  legacyHeaderSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2
  },
  legacyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  legacyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  legacyServiceCard: {
    backgroundColor: '#161420',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252136',
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  legacyServiceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  legacyServiceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  legacyServiceCat: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  legacyServicePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981'
  },
  legacyServiceDesc: {
    fontSize: 12,
    color: '#71717A',
    marginVertical: 6,
    lineHeight: 16
  },
  legacyServiceBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#221E33'
  },
  legacyActions: {
    flexDirection: 'row',
    gap: 12
  },
  legacyActionBtn: {
    padding: 4
  },
  emptyAddBtn: {
    marginTop: spacing.md,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  // Modal Common Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg
  },
  rateModalContent: {
    backgroundColor: '#161420',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2845',
    padding: spacing.lg
  },
  legacyModalContent: {
    backgroundColor: '#161420',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E2845',
    padding: spacing.lg,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalSub: {
    fontSize: 12,
    color: '#A78BFA',
    marginTop: 2
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
    marginTop: 8
  },
  modalInput: {
    backgroundColor: '#100E17',
    borderWidth: 1,
    borderColor: '#2E2845',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 8
  },
  pricingTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md
  },
  pricingTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E2845',
    alignItems: 'center',
    backgroundColor: '#100E17'
  },
  pricingTypeBtnSelected: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.2)'
  },
  pricingTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A'
  },
  pricingTypeBtnTextSelected: {
    color: '#A78BFA',
    fontWeight: '700'
  },
  modalActionButtons: {
    flexDirection: 'row',
    marginTop: spacing.md
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#100E17',
    borderWidth: 1,
    borderColor: '#2E2845',
    marginRight: 8
  },
  catChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6'
  },
  catChipText: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  catChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700'
  }
});
