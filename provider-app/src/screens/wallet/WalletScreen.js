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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletApi } from '../../services/api';
import colors from '../../theme/colors';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'withdrawals', label: 'Withdrawals' },
  { key: 'adjustments', label: 'Adjustments' }
];

export default function WalletScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const fetchWalletData = useCallback(async () => {
    try {
      const [summaryRes, earningsRes, txnsRes] = await Promise.all([
        walletApi.getSummary().catch(() => ({ data: null })),
        walletApi.getEarnings().catch(() => ({ data: null })),
        walletApi.getTransactions({ type: activeFilter, limit: 30 }).catch(() => ({ data: [] }))
      ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (earningsRes?.data) setEarnings(earningsRes.data);
      if (txnsRes?.data) setTransactions(txnsRes.data);
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

  const getTxnIcon = (type) => {
    switch (type) {
      case 'booking_earning':
        return { name: 'arrow-down-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'commission_deduction':
        return { name: 'pie-chart-outline', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'withdrawal':
        return { name: 'arrow-up-circle', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' };
      case 'withdrawal_refund':
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
    return ['booking_earning', 'withdrawal_refund', 'adjustment_credit'].includes(type);
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
  const pendingWithdrawal = summary?.pendingWithdrawal || 0;
  const totalEarnings = summary?.totalEarnings || 0;
  const totalWithdrawn = summary?.totalWithdrawn || 0;

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

      <ScrollView
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

        {/* 4 Overview Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="trending-up" size={18} color="#10B981" />
            </View>
            <Text style={styles.statLabel}>Lifetime Earnings</Text>
            <Text style={styles.statValue}>₹{totalEarnings.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="cash-outline" size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>₹{totalWithdrawn.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="receipt-outline" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{summary?.totalTransactions || 0}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Ionicons name="hourglass-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.statLabel}>Pending Requests</Text>
            <Text style={styles.statValue}>{summary?.pendingWithdrawalsCount || 0}</Text>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
          <Text style={styles.commissionNote}>85% Provider Net (15% Platform Take-Rate)</Text>
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
  }
});

