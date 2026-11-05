import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Platform,
  Alert,
  Modal,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletApi } from '../../services/api';
import { openCommissionPaymentCheckout } from '../../services/commissionPaymentService';
import colors from '../../theme/colors';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'commission', label: 'Commission' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'adjustments', label: 'Adjustments' }
];

export default function WalletScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [commissionData, setCommissionData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [payingCommission, setPayingCommission] = useState(false);
  const [togglingAutoDeduct, setTogglingAutoDeduct] = useState(false);
  const [autoDeductModalVisible, setAutoDeductModalVisible] = useState(false);
  const [targetAutoDeductValue, setTargetAutoDeductValue] = useState(false);
  const [autoDeductFeedback, setAutoDeductFeedback] = useState(null);
  const [commissionModalVisible, setCommissionModalVisible] = useState(false);

  const fetchWalletData = useCallback(async () => {
    try {
      const [summaryRes, earningsRes, txnsRes, commRes] = await Promise.all([
        walletApi.getSummary().catch(() => ({ data: null })),
        walletApi.getEarnings().catch(() => ({ data: null })),
        walletApi.getTransactions({ type: activeFilter, limit: 30 }).catch(() => ({ data: [] })),
        walletApi.getCommissionDetails().catch(() => ({ data: null }))
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (earningsRes?.data) setEarnings(earningsRes.data);
      if (txnsRes?.data) setTransactions(txnsRes.data);
      if (commRes?.data) setCommissionData(commRes.data);
    } catch (err) {
      console.error('[WALLET_FETCH_ERROR]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [fetchWalletData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  const handlePayCommissionNow = async () => {
    const amountToPay = summary?.commissionDue || commissionData?.commissionDue || 0;
    if (amountToPay <= 0) {
      Alert.alert('No Due', 'You do not have any outstanding commission payable.');
      return;
    }

    Alert.alert(
      'Pay Full Commission',
      `You are about to settle the complete outstanding platform commission of ₹${amountToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })} in one transaction via Razorpay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay ₹${amountToPay}`,
          onPress: async () => {
            setPayingCommission(true);
            try {
              const orderRes = await walletApi.createPayCommissionOrder();
              if (!orderRes?.success || !orderRes.data) {
                throw new Error(orderRes?.message || 'Could not initiate payment order');
              }

              const checkoutResult = await openCommissionPaymentCheckout({
                orderData: orderRes.data,
                providerName: 'Mendroo Service Provider'
              });

              if (!checkoutResult.success) {
                // Cancel active lock so order can be immediately retried if needed
                walletApi.cancelPayCommissionOrder().catch(() => { });
                if (!checkoutResult.isCancelled) {
                  Alert.alert('Payment Incomplete', checkoutResult.error || 'Payment was not completed. Outstanding commission remains unchanged.');
                }
                setPayingCommission(false);
                return;
              }

              // Verify on backend
              const verifyRes = await walletApi.verifyCommissionPayment({
                razorpayOrderId: checkoutResult.data.razorpayOrderId,
                razorpayPaymentId: checkoutResult.data.razorpayPaymentId,
                razorpaySignature: checkoutResult.data.razorpaySignature
              });

              if (verifyRes?.success) {
                Alert.alert('Settlement Successful', 'Your platform commission has been settled in full. Commission Payable is now ₹0.');
                fetchWalletData();
              } else {
                Alert.alert('Verification Issue', verifyRes?.message || 'Payment verification could not be confirmed.');
              }
            } catch (err) {
              Alert.alert('Payment Error', err.response?.data?.error?.message || err.message || 'Payment failed');
            } finally {
              setPayingCommission(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleAutoDeduct = (newValue) => {
    if (togglingAutoDeduct) return;
    setTargetAutoDeductValue(Boolean(newValue));
    setAutoDeductModalVisible(true);
  };

  const executeToggleAutoDeduct = async () => {
    if (togglingAutoDeduct) return;
    setTogglingAutoDeduct(true);
    setAutoDeductFeedback(null);
    try {
      const res = await walletApi.toggleAutoDeductCommission(targetAutoDeductValue);
      if (res?.success) {
        // Immediate optimistic UI sync
        if (res.data?.summary) {
          setSummary(res.data.summary);
        } else {
          setSummary((prev) => (prev ? { ...prev, autoDeductCommissionFromWallet: targetAutoDeductValue } : prev));
        }
        setAutoDeductModalVisible(false);
        setAutoDeductFeedback({
          type: 'success',
          message: targetAutoDeductValue
            ? (res.data?.deductionResult?.deducted
              ? `Auto-Deduct activated! Full commission of ₹${res.data.deductionResult.amount?.toLocaleString('en-IN')} was settled from your Available Balance.`
              : 'Auto-Deduct enabled. Mendroo will settle commission automatically when balance is sufficient.')
            : 'Auto-Deduct disabled. Manual settlement active.'
        });
        await fetchWalletData();
      } else {
        setAutoDeductFeedback({
          type: 'error',
          message: res?.message || 'Could not update auto deduction setting'
        });
      }
    } catch (err) {
      console.error('[TOGGLE_AUTO_DEDUCT_ERROR]', err);
      setAutoDeductFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to update auto deduction'
      });
    } finally {
      setTogglingAutoDeduct(false);
    }
  };

  const getTxnIcon = (type) => {
    switch (type) {
      case 'booking_earning':
        return { name: 'arrow-down-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'CASH_BOOKING_COMMISSION_DUE':
      case 'commission_deduction':
        return { name: 'pie-chart-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'COMMISSION_PAYMENT':
      case 'COMMISSION_ADJUSTMENT':
      case 'COMMISSION_WALLET_AUTO_DEBIT':
        return { name: 'checkmark-circle-outline', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'withdrawal':
        return { name: 'arrow-up-circle', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'withdrawal_refund':
      case 'COMMISSION_REFUND':
        return { name: 'refresh-circle', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' };
      case 'adjustment_credit':
        return { name: 'add-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'adjustment_debit':
      case 'penalty':
        return { name: 'remove-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default:
        return { name: 'cash-outline', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' };
    }
  };

  const isCredit = (type) => {
    return ['booking_earning', 'withdrawal_refund', 'adjustment_credit', 'COMMISSION_REFUND'].includes(type);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading wallet details...</Text>
      </SafeAreaView>
    );
  }

  const availableBalance = summary?.availableBalance || 0;
  const pendingEarnings = summary?.pendingBalance || 0;
  const commissionPayable = summary?.commissionDue || commissionData?.commissionDue || 0;
  const lifetimeEarnings = summary?.totalEarnings || 0;
  const pendingWithdrawal = summary?.pendingWithdrawal || 0;
  const totalWithdrawn = summary?.totalWithdrawn || 0;
  const autoDeductEnabled = summary?.autoDeductCommissionFromWallet ?? commissionData?.autoDeductCommissionFromWallet ?? false;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <TouchableOpacity
          style={styles.headerWithdrawButton}
          onPress={() => navigation.navigate('Withdraw', { availableBalance, savedPaymentMethods: summary?.savedPaymentMethods })}
        >
          <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
          <Text style={styles.headerWithdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Main Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardHeader}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <Text style={styles.balanceAmount}>
                ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.walletBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={styles.walletBadgeText}>Verified</Text>
            </View>
          </View>

          {pendingWithdrawal > 0 && (
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={styles.pendingText}>
                ₹{pendingWithdrawal.toLocaleString('en-IN')} pending in withdrawal request
              </Text>
            </View>
          )}

          <View style={styles.balanceCardActions}>
            <TouchableOpacity
              style={styles.withdrawActionButton}
              onPress={() => navigation.navigate('Withdraw', { availableBalance, savedPaymentMethods: summary?.savedPaymentMethods })}
            >
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              <Text style={styles.withdrawActionButtonText}>Withdraw Funds</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 Financial Sections Core Cards */}
        <View style={styles.statsGrid}>
          {/* 1. Available Balance */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="wallet" size={18} color="#10B981" />
            </View>
            <Text style={styles.statLabel}>Available Balance</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statSubText}>Withdrawable</Text>
          </View>

          {/* 2. Pending Earnings */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="time" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statLabel}>Pending Earnings</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              ₹{pendingEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statSubText}>Awaiting release</Text>
          </View>

          {/* 3. Commission Payable to Mendroo */}
          <View style={[styles.statBox, commissionPayable > 0 && styles.statBoxAlert]}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
            </View>
            <Text style={styles.statLabel}>Commission Payable to Mendroo</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              ₹{commissionPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statSubText}>Cash booking dues</Text>
          </View>

          {/* 4. Lifetime Earnings */}
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="trending-up" size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.statLabel}>Lifetime Earnings</Text>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>
              ₹{lifetimeEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.statSubText}>Total verified earnings</Text>
          </View>
        </View>

        {/* Dedicated Commission Payable Section */}
        <View style={styles.commissionSectionCard}>
          <View style={styles.commissionSectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="receipt" size={18} color="#EF4444" />
                <Text style={styles.commissionSectionTitle}>Commission Payable to Mendroo</Text>
              </View>
              <Text style={styles.commissionSectionDesc}>
                Outstanding platform commission owed from completed cash bookings.
              </Text>
            </View>
            <Text style={styles.commissionSectionAmount}>
              ₹{commissionPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          {commissionPayable > 0 ? (
            <View style={styles.commissionPayActionContainer}>
              <View style={styles.settlementOptionBadgeRow}>
                <Text style={styles.settlementOptionBadge}>OPTION 1</Text>
                <Text style={styles.settlementOptionTitle}>Pay Full Commission Now</Text>
              </View>
              <TouchableOpacity
                style={styles.payCommissionButton}
                onPress={handlePayCommissionNow}
                disabled={payingCommission}
                activeOpacity={0.8}
              >
                {payingCommission ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="card" size={18} color="#FFFFFF" />
                    <Text style={styles.payCommissionButtonText}>
                      Pay Full Commission ₹{commissionPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.commissionPayNote}>
                Full platform commission is settled in one single transaction via Razorpay.
              </Text>
            </View>
          ) : (
            <View style={styles.commissionCleanContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.commissionCleanText}>All cash booking commissions are fully settled!</Text>
            </View>
          )}

          {/* Option 2: Auto Deduct from Wallet */}
          <View style={styles.autoDeductCard}>
            <View style={styles.settlementOptionBadgeRow}>
              <Text style={[styles.settlementOptionBadge, { backgroundColor: '#3B82F6' }]}>OPTION 2</Text>
              <Text style={styles.settlementOptionTitle}>Auto Deduct from Wallet</Text>
            </View>

            <TouchableOpacity
              style={styles.autoDeductRow}
              activeOpacity={0.85}
              onPress={() => handleToggleAutoDeduct(!autoDeductEnabled)}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.autoDeductHeading}>Auto Deduct Commission from Wallet</Text>
                <Text style={styles.autoDeductDesc}>
                  When your Available Balance is sufficient, Mendroo will automatically deduct your entire outstanding commission in one transaction.
                </Text>
              </View>
              {togglingAutoDeduct ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Switch
                  value={autoDeductEnabled}
                  onValueChange={handleToggleAutoDeduct}
                  trackColor={{ false: '#374151', true: '#10B981' }}
                  thumbColor={autoDeductEnabled ? '#FFFFFF' : '#9CA3AF'}
                  disabled={togglingAutoDeduct}
                />
              )}
            </TouchableOpacity>

            {/* In-Screen Feedback Notification Banner */}
            {autoDeductFeedback && (
              <View style={[
                styles.feedbackBanner,
                autoDeductFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
              ]}>
                <Ionicons
                  name={autoDeductFeedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={autoDeductFeedback.type === 'success' ? '#10B981' : '#EF4444'}
                />
                <Text style={[
                  styles.feedbackText,
                  { color: autoDeductFeedback.type === 'success' ? '#D1FAE5' : '#FEE2E2' }
                ]}>
                  {autoDeductFeedback.message}
                </Text>
                <TouchableOpacity
                  onPress={() => setAutoDeductFeedback(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Status Display */}
            {autoDeductEnabled ? (
              commissionPayable > 0 && availableBalance < commissionPayable ? (
                <View style={styles.autoDeductInsufficientBox}>
                  <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                  <Text style={styles.autoDeductInsufficientText}>
                    Available Balance (₹{availableBalance.toLocaleString('en-IN')}) is insufficient to cover ₹{commissionPayable.toLocaleString('en-IN')} due. Zero deduction made. The system will automatically settle in full when your balance is replenished.
                  </Text>
                </View>
              ) : (
                <View style={styles.autoDeductActiveBox}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.autoDeductActiveText}>
                    Active – Automatic full settlement enabled
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.autoDeductInactiveBox}>
                <Ionicons name="ellipse-outline" size={12} color="#9CA3AF" />
                <Text style={styles.autoDeductInactiveText}>Manual payment only</Text>
              </View>
            )}

            {/* Overdraft Protection Guarantee Badge */}
            <View style={styles.protectionGuaranteeBadge}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#8B5CF6" />
              <Text style={styles.protectionGuaranteeText}>
                Protected: Never deducted from Pending Earnings. Never results in a negative balance.
              </Text>
            </View>
          </View>

          {/* Button to open Breakdown Modal */}
          <TouchableOpacity
            style={styles.viewCommissionDetailsBtn}
            onPress={() => setCommissionModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewCommissionDetailsText}>View Commission Payable Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#A78BFA" />
          </TouchableOpacity>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
          <Text style={styles.commissionNote}>{commissionData?.commissionRateText || 'Platform commission'} applies on completed jobs</Text>
        </View>

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownCol}>
            <Text style={styles.breakdownLabel}>Today</Text>
            <Text style={styles.breakdownAmount}>₹{(earnings?.today?.amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.breakdownCount}>{earnings?.today?.count || 0} jobs</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownCol}>
            <Text style={styles.breakdownLabel}>This Week</Text>
            <Text style={styles.breakdownAmount}>₹{(earnings?.thisWeek?.amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.breakdownCount}>{earnings?.thisWeek?.count || 0} jobs</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownCol}>
            <Text style={styles.breakdownLabel}>This Month</Text>
            <Text style={styles.breakdownAmount}>₹{(earnings?.thisMonth?.amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.breakdownCount}>{earnings?.thisMonth?.count || 0} jobs</Text>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterTabsRow}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Transaction List */}
        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={44} color="#71717A" />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'all'
                ? 'Your completed bookings and payouts will be recorded here.'
                : `No transactions found under '${activeFilter}'.`}
            </Text>
          </View>
        ) : (
          <View style={styles.txnList}>
            {transactions.map((item) => {
              const icon = getTxnIcon(item.type);
              const credit = isCredit(item.type);
              return (
                <View key={item._id} style={styles.txnCard}>
                  <View style={[styles.txnIconWrap, { backgroundColor: icon.bg }]}>
                    <Ionicons name={icon.name} size={22} color={icon.color} />
                  </View>
                  <View style={styles.txnMain}>
                    <Text style={styles.txnTitle} numberOfLines={1}>
                      {item.description || item.type}
                    </Text>
                    <Text style={styles.txnDate}>{formatDate(item.createdAt)}</Text>
                    <View style={styles.txnMetaRow}>
                      <Text style={styles.txnRef}>Ref: {item.transactionReference}</Text>
                      <View style={[styles.statusTag, item.status === 'completed' ? styles.statusSuccess : styles.statusPending]}>
                        <Text style={styles.statusTagText}>{item.status}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, credit ? styles.amountCredit : styles.amountDebit]}>
                      {credit ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.balanceAfterText}>
                      Bal: ₹{item.balanceAfter?.toLocaleString('en-IN') || 0}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Auto Deduct Confirmation Dialog (Cross-Platform Modal) */}
      <Modal
        visible={autoDeductModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!togglingAutoDeduct) setAutoDeductModalVisible(false);
        }}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[
                styles.confirmIconCircle,
                { backgroundColor: targetAutoDeductValue ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
              ]}>
                <Ionicons
                  name={targetAutoDeductValue ? 'wallet-outline' : 'power-outline'}
                  size={30}
                  color={targetAutoDeductValue ? '#10B981' : '#EF4444'}
                />
              </View>
              <Text style={styles.confirmModalTitle}>
                {targetAutoDeductValue ? 'Enable Auto Deduction?' : 'Disable Auto Deduction?'}
              </Text>
              <Text style={styles.confirmModalBody}>
                {targetAutoDeductValue
                  ? 'Mendroo will automatically settle your entire outstanding commission in full only when your positive Available Wallet Balance has sufficient funds. We will never make your balance negative. You can disable this anytime.'
                  : 'Are you sure you want to turn off automatic commission deduction? You will need to manually pay your outstanding commission using "Pay Full Commission Now".'}
              </Text>
            </View>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setAutoDeductModalVisible(false)}
                disabled={togglingAutoDeduct}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmExecuteBtn,
                  { backgroundColor: targetAutoDeductValue ? '#10B981' : '#EF4444' }
                ]}
                onPress={executeToggleAutoDeduct}
                disabled={togglingAutoDeduct}
                activeOpacity={0.8}
              >
                {togglingAutoDeduct ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmExecuteBtnText}>
                    {targetAutoDeductValue ? 'Confirm & Enable' : 'Disable'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Commission Payable Details Modal */}
      <Modal
        visible={commissionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCommissionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Commission Payable Details</Text>
                <Text style={styles.modalSubtitle}>Platform commission from completed cash bookings</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCommissionModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Total Due Callout */}
            <View style={styles.modalDueSummaryBox}>
              <Text style={styles.modalDueSummaryLabel}>TOTAL OUTSTANDING COMMISSION</Text>
              <Text style={styles.modalDueSummaryValue}>
                ₹{commissionPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={styles.modalDueSummaryNote}>
                Never deducted from your withdrawable Available Balance. Settled in full via Razorpay or automatic future earnings adjustment.
              </Text>
            </View>

            <ScrollView showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginVertical: 12 }}>
              <Text style={styles.modalListHeading}>Cash Bookings Breakdown</Text>
              {(!commissionData?.history || commissionData.history.length === 0) ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={36} color="#6B7280" />
                  <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 8 }}>No cash booking commission records found.</Text>
                </View>
              ) : (
                commissionData.history.map((item) => (
                  <View key={item._id} style={styles.commissionDetailItem}>
                    <View style={styles.commissionItemTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commissionItemRef}>Booking #{item.bookingReference}</Text>
                        <Text style={styles.commissionItemService}>{item.serviceName}</Text>
                      </View>
                      <View style={[
                        styles.commissionItemTag,
                        item.type === 'COMMISSION_PAYMENT' ? { backgroundColor: 'rgba(16, 185, 129, 0.2)' } :
                          item.type === 'COMMISSION_ADJUSTMENT' ? { backgroundColor: 'rgba(139, 92, 246, 0.2)' } :
                            { backgroundColor: 'rgba(239, 68, 68, 0.2)' }
                      ]}>
                        <Text style={[
                          styles.commissionItemTagText,
                          item.type === 'COMMISSION_PAYMENT' ? { color: '#10B981' } :
                            item.type === 'COMMISSION_ADJUSTMENT' ? { color: '#8B5CF6' } :
                              { color: '#EF4444' }
                        ]}>
                          {item.type === 'COMMISSION_PAYMENT' ? 'SETTLED' :
                            item.type === 'COMMISSION_ADJUSTMENT' ? 'AUTO-ADJUSTED' : 'DUE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.commissionItemGrid}>
                      <View style={styles.commissionGridCol}>
                        <Text style={styles.commissionGridLabel}>Customer Paid</Text>
                        <Text style={styles.commissionGridVal}>₹{item.customerPaymentAmount || 0}</Text>
                      </View>
                      <View style={styles.commissionGridCol}>
                        <Text style={styles.commissionGridLabel}>Commissionable</Text>
                        <Text style={styles.commissionGridVal}>₹{item.commissionableAmount || item.originalServicePrice || item.customerPaymentAmount || 0}</Text>
                      </View>
                      <View style={styles.commissionGridCol}>
                        <Text style={styles.commissionGridLabel}>Commission ({item.commissionPercentage})</Text>
                        <Text style={[styles.commissionGridVal, { color: '#EF4444' }]}>₹{item.amount}</Text>
                      </View>
                    </View>

                    {item.additionalPartsAmount > 0 && (
                      <View style={{ marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>
                          Extra Materials (₹{item.additionalPartsAmount})
                        </Text>
                        <Text style={{ color: '#34D399', fontSize: 10, fontWeight: '700' }}>
                          0% Commission (100% Provider Earning)
                        </Text>
                      </View>
                    )}

                    <Text style={styles.commissionItemDate}>{formatDate(item.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {commissionPayable > 0 && (
              <TouchableOpacity
                style={styles.payCommissionButton}
                onPress={() => {
                  setCommissionModalVisible(false);
                  handlePayCommissionNow();
                }}
                disabled={payingCommission}
                activeOpacity={0.8}
              >
                <Ionicons name="card" size={18} color="#FFFFFF" />
                <Text style={styles.payCommissionButtonText}>
                  Pay Full Commission ₹{commissionPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0E'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0B0E',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#9CA3AF',
    fontSize: 14
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1C2B',
    backgroundColor: '#0F0E16'
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E1B2E',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  headerWithdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4
  },
  headerWithdrawText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  balanceCard: {
    backgroundColor: '#1C1635',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#382D67',
    marginBottom: 20
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  balanceLabel: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  walletBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600'
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6
  },
  pendingText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500'
  },
  balanceCardActions: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16
  },
  withdrawActionButton: {
    flexDirection: 'row',
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  withdrawActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  statBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#16141F',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252136'
  },
  statIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  commissionNote: {
    fontSize: 11,
    color: '#A78BFA'
  },
  breakdownCard: {
    flexDirection: 'row',
    backgroundColor: '#16141F',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#252136',
    marginBottom: 24,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center'
  },
  breakdownDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#252136'
  },
  breakdownLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4
  },
  breakdownAmount: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2
  },
  breakdownCount: {
    color: '#71717A',
    fontSize: 11
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#16141F',
    borderWidth: 1,
    borderColor: '#252136'
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6'
  },
  filterChipText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600'
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16141F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252136'
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4
  },
  emptySubtitle: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 32
  },
  txnList: {
    gap: 10
  },
  txnCard: {
    flexDirection: 'row',
    backgroundColor: '#16141F',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#252136',
    alignItems: 'center'
  },
  txnIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  txnMain: {
    flex: 1,
    marginRight: 8
  },
  txnTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2
  },
  txnDate: {
    color: '#71717A',
    fontSize: 11,
    marginBottom: 4
  },
  txnMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  txnRef: {
    color: '#9CA3AF',
    fontSize: 10
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  statusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)'
  },
  statusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)'
  },
  statusTagText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  txnRight: {
    alignItems: 'flex-end'
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700'
  },
  amountCredit: {
    color: '#10B981'
  },
  amountDebit: {
    color: '#EF4444'
  },
  balanceAfterText: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 2
  },
  // Commission Specific Styles
  statSubText: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 2
  },
  statBoxAlert: {
    borderColor: '#7F1D1D',
    borderWidth: 1.5
  },
  commissionSectionCard: {
    backgroundColor: '#1E1424',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3B1F38',
    marginBottom: 20
  },
  commissionSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  commissionSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  commissionSectionDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  commissionSectionAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EF4444',
    marginLeft: 8
  },
  commissionPayActionContainer: {
    marginTop: 8,
    marginBottom: 8
  },
  payCommissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8
  },
  payCommissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  commissionPayNote: {
    color: '#A1A1AA',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6
  },
  commissionCleanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8
  },
  commissionCleanText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600'
  },
  settlementOptionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  settlementOptionBadge: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5
  },
  settlementOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F3F4F6'
  },
  autoDeductCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginTop: 8,
    marginBottom: 10
  },
  autoDeductRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  autoDeductHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2
  },
  autoDeductDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15
  },
  autoDeductInsufficientBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 8
  },
  autoDeductInsufficientText: {
    flex: 1,
    fontSize: 11,
    color: '#FCD34D',
    lineHeight: 16
  },
  autoDeductActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 8
  },
  autoDeductActiveText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600'
  },
  autoDeductInactiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    marginBottom: 8
  },
  autoDeductInactiveText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500'
  },
  protectionGuaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4
  },
  protectionGuaranteeText: {
    flex: 1,
    fontSize: 10,
    color: '#A78BFA',
    fontWeight: '500',
    lineHeight: 14
  },
  viewCommissionDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4
  },
  viewCommissionDetailsText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '600'
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#16141F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#252136'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#252136',
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 4
  },
  modalDueSummaryBox: {
    backgroundColor: '#27151D',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#541C2A'
  },
  modalDueSummaryLabel: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  modalDueSummaryValue: {
    color: '#EF4444',
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 4
  },
  modalDueSummaryNote: {
    color: '#FDA4AF',
    fontSize: 11,
    lineHeight: 15
  },
  modalListHeading: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8
  },
  commissionDetailItem: {
    backgroundColor: '#1E1B2E',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2E2845'
  },
  commissionItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  commissionItemRef: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  },
  commissionItemService: {
    color: '#A78BFA',
    fontSize: 11,
    marginTop: 2
  },
  commissionItemTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  commissionItemTagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  commissionItemGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#28233C',
    paddingTop: 8,
    marginBottom: 6
  },
  commissionGridCol: {
    flex: 1
  },
  commissionGridLabel: {
    color: '#9CA3AF',
    fontSize: 10
  },
  commissionGridVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  commissionItemDate: {
    color: '#71717A',
    fontSize: 10
  },
  // Auto Deduct Confirmation Modal Styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  confirmModalContent: {
    backgroundColor: '#16141F',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#2D2842'
  },
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  confirmModalBody: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#262238',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#37324E'
  },
  confirmCancelBtnText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600'
  },
  confirmExecuteBtn: {
    flex: 1.2,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmExecuteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  // Feedback Banner Styles
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500'
  }
});

