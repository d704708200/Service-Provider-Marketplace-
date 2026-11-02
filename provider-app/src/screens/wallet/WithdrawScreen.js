import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { walletApi } from '../../services/api';

const QUICK_AMOUNTS = [500, 1000, 2000];

export default function WithdrawScreen({ route, navigation }) {
  const { availableBalance = 0, savedPaymentMethods = {} } = route.params || {};

  const [currentBalance, setCurrentBalance] = useState(availableBalance);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi'); // 'upi' or 'bank_transfer'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch fresh wallet balance on mount
  React.useEffect(() => {
    walletApi.getSummary()
      .then((res) => {
        if (res?.data?.availableBalance !== undefined) {
          setCurrentBalance(res.data.availableBalance);
        }
      })
      .catch(() => { });
  }, []);

  // Form states
  const [upiId, setUpiId] = useState(savedPaymentMethods?.upi?.upiId || '');
  const [upiName, setUpiName] = useState(savedPaymentMethods?.upi?.name || '');

  const [accountHolderName, setAccountHolderName] = useState(savedPaymentMethods?.bank?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(savedPaymentMethods?.bank?.accountNumber || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(savedPaymentMethods?.bank?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(savedPaymentMethods?.bank?.ifscCode || '');
  const [bankName, setBankName] = useState(savedPaymentMethods?.bank?.bankName || '');

  const handleQuickAmount = (val) => {
    if (val === 'ALL') {
      setAmount(Math.floor(currentBalance).toString());
    } else {
      setAmount(val.toString());
    }
    setErrorMessage('');
  };

  const handleWithdraw = async () => {
    setErrorMessage('');
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 100) {
      setErrorMessage('Minimum withdrawal amount is ₹100');
      return;
    }

    if (numAmount > currentBalance) {
      setErrorMessage(`Insufficient balance. You can withdraw up to ₹${currentBalance.toLocaleString('en-IN')}`);
      return;
    }

    let payoutDetails = {};
    if (method === 'upi') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setErrorMessage('Please enter a valid UPI ID (e.g. name@bank)');
        return;
      }
      payoutDetails = {
        upiId: upiId.trim(),
        accountHolderName: upiName.trim()
      };
    } else {
      if (!accountHolderName.trim()) {
        setErrorMessage('Please enter the Account Holder Name');
        return;
      }
      if (!accountNumber.trim() || accountNumber.length < 8) {
        setErrorMessage('Please enter a valid Account Number');
        return;
      }
      if (accountNumber !== confirmAccountNumber) {
        setErrorMessage('Account numbers do not match');
        return;
      }
      if (!ifscCode.trim() || ifscCode.trim().length !== 11) {
        setErrorMessage('Please enter a valid 11-character IFSC Code');
        return;
      }
      payoutDetails = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        bankName: bankName.trim()
      };
    }

    try {
      setLoading(true);
      const res = await walletApi.requestWithdrawal({
        amount: numAmount,
        payoutMethod: method,
        payoutDetails
      });

      const successRef = res?.data?.withdrawalRequest?.requestReference || '';
      const successMsg = `Your withdrawal request of ₹${numAmount.toLocaleString('en-IN')} has been submitted successfully.\nRef: ${successRef}`;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(successMsg);
        }
        navigation.goBack();
      } else {
        Alert.alert(
          'Request Submitted',
          successMsg,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ],
          { cancelable: false }
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit withdrawal request';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Withdraw Money</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Available Balance Banner */}
          <View style={styles.availableBox}>
            <View>
              <Text style={styles.availableLabel}>Available Balance</Text>
              <Text style={styles.availableValue}>
                ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <Ionicons name="wallet" size={32} color="#8B5CF6" />
          </View>

          {/* Amount Input */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Withdrawal Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#71717A"
                keyboardType="numeric"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  setErrorMessage('');
                }}
              />
            </View>
            <Text style={styles.helperText}>Minimum withdrawal is ₹100. Payout takes 24–48 hours.</Text>
          </View>

          {/* Quick Select Chips */}
          <View style={styles.quickChipsRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={styles.quickChip}
                onPress={() => handleQuickAmount(amt)}
              >
                <Text style={styles.quickChipText}>+₹{amt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.quickChip, styles.allChip]}
              onPress={() => handleQuickAmount('ALL')}
            >
              <Text style={styles.allChipText}>All Balance</Text>
            </TouchableOpacity>
          </View>

          {/* Method Selector Tabs */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Payout Method</Text>
            <View style={styles.methodToggleRow}>
              <TouchableOpacity
                style={[styles.methodTab, method === 'upi' && styles.methodTabActive]}
                onPress={() => {
                  setMethod('upi');
                  setErrorMessage('');
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={method === 'upi' ? '#FFFFFF' : '#9CA3AF'}
                />
                <Text style={[styles.methodTabText, method === 'upi' && styles.methodTabTextActive]}>
                  UPI (Instant)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.methodTab, method === 'bank_transfer' && styles.methodTabActive]}
                onPress={() => {
                  setMethod('bank_transfer');
                  setErrorMessage('');
                }}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={method === 'bank_transfer' ? '#FFFFFF' : '#9CA3AF'}
                />
                <Text
                  style={[
                    styles.methodTabText,
                    method === 'bank_transfer' && styles.methodTabTextActive
                  ]}
                >
                  Bank Transfer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form details for UPI */}
          {method === 'upi' ? (
            <View style={styles.methodFormCard}>
              <Text style={styles.subCardTitle}>UPI Details</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>UPI ID (VPA)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. mobile@upi or name@okaxis"
                  placeholderTextColor="#71717A"
                  autoCapitalize="none"
                  value={upiId}
                  onChangeText={setUpiId}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Account Holder Name (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Rajesh Kumar"
                  placeholderTextColor="#71717A"
                  value={upiName}
                  onChangeText={setUpiName}
                />
              </View>
            </View>
          ) : (
            /* Form details for Bank Transfer */
            <View style={styles.methodFormCard}>
              <Text style={styles.subCardTitle}>Bank Account Details</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Account Holder Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Full name as registered in bank"
                  placeholderTextColor="#71717A"
                  value={accountHolderName}
                  onChangeText={setAccountHolderName}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Account Number *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 123456789012"
                  placeholderTextColor="#71717A"
                  keyboardType="number-pad"
                  secureTextEntry={false}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Confirm Account Number *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Re-enter bank account number"
                  placeholderTextColor="#71717A"
                  keyboardType="number-pad"
                  value={confirmAccountNumber}
                  onChangeText={setConfirmAccountNumber}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>IFSC Code *</Text>
                <TextInput
                  style={[styles.textInput, { textTransform: 'uppercase' }]}
                  placeholder="e.g. HDFC0001234"
                  placeholderTextColor="#71717A"
                  autoCapitalize="characters"
                  maxLength={11}
                  value={ifscCode}
                  onChangeText={(val) => setIfscCode(val.toUpperCase())}
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Bank Name (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. HDFC Bank"
                  placeholderTextColor="#71717A"
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>
            </View>
          )}

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* SLA Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#A78BFA" />
            <Text style={styles.infoText}>
              Withdrawal requests are processed by the administrator. Disbursal confirmation is directly updated in your transaction history.
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleWithdraw}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Withdrawal</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0E'
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  availableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1635',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#382D67',
    marginBottom: 20
  },
  availableLabel: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4
  },
  availableValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800'
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252136',
    paddingHorizontal: 16,
    height: 56
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: '#8B5CF6',
    marginRight: 8
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  helperText: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 6
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#161420',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252136'
  },
  quickChipText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600'
  },
  allChip: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.15)'
  },
  allChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#161420',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#252136'
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  methodTabActive: {
    backgroundColor: '#7C3AED'
  },
  methodTabText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600'
  },
  methodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  methodFormCard: {
    backgroundColor: '#16141F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252136',
    marginBottom: 20
  },
  subCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12
  },
  inputWrap: {
    marginBottom: 12
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6
  },
  textInput: {
    backgroundColor: '#0F0E16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252136',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)'
  },
  infoText: {
    color: '#CBD5E1',
    fontSize: 12,
    flex: 1,
    lineHeight: 18
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.6
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  }
});

