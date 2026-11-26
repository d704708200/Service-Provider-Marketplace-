import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Header, Card, Input, Button, SupportContactCard } from '../../components/common';
import { SUPPORT_CONFIG } from '../../constants/support';
import { spacing, typography, borderRadius } from '../../theme';

const PROVIDER_INQUIRY_CATEGORIES = [
  { id: 'payout', label: 'Payout / Wallet', icon: 'wallet-outline' },
  { id: 'dispute', label: 'Customer Dispute', icon: 'alert-circle-outline' },
  { id: 'kyc', label: 'KYC & Verification', icon: 'shield-checkmark-outline' },
  { id: 'booking', label: 'Job / Booking Issue', icon: 'briefcase-outline' },
  { id: 'technical', label: 'Technical Support', icon: 'hardware-chip-outline' }
];

const PROVIDER_FAQS = [
  {
    q: 'How do I contact provider helpline directly?',
    a: `Call our dedicated MENDROO provider helpline at ${SUPPORT_CONFIG.DISPLAY_NUMBER} Monday through Saturday between 8:00 AM and 8:00 PM IST.`
  },
  {
    q: 'When are wallet withdrawals processed?',
    a: 'Bank transfer and UPI withdrawals are processed every business day within 24 to 48 hours following admin verification.'
  },
  {
    q: 'How does MENDROO handle customer disputes?',
    a: 'If a customer raises an unjustified complaint or refuses payment for approved services, file a dispute ticket here or call helpline. Our mediation team investigates and protects verified providers.'
  }
];

export default function SupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [selectedCategory, setSelectedCategory] = useState('payout');
  const [referenceId, setReferenceId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSubmitTicket = () => {
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a brief subject for your provider inquiry.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Details', 'Please provide detailed information about your inquiry or dispute.');
      return;
    }

    setSubmitting(true);

    setTimeout(() => {
      setSubmitting(false);
      const ticketId = `PRV-${Date.now().toString().slice(-6)}`;
      Alert.alert(
        'Support Ticket Created',
        `Your support request #${ticketId} has been registered.\n\nOur provider partner care team will review your ticket and reach out. For urgent inquiries, call our helpline at ${SUPPORT_CONFIG.DISPLAY_NUMBER}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSubject('');
              setDescription('');
              setReferenceId('');
            }
          }
        ]
      );
    }, 800);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header
        title="Help & Support"
        subtitle="Provider Partner Care & Disputes"
        showBack={Boolean(navigation?.canGoBack())}
        onBack={() => navigation?.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Official Phone Helpline Card */}
          <SupportContactCard />

          {/* Provider Care & Dispute Form */}
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formHeaderIcon}>
                <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>Submit Inquiry or Dispute</Text>
                <Text style={styles.formSubtitle}>
                  Direct ticket to MENDROO Provider Relations & Operations
                </Text>
              </View>
            </View>

            {/* Category Selector */}
            <Text style={styles.inputLabel}>Inquiry Type *</Text>
            <View style={styles.categoryRow}>
              {PROVIDER_INQUIRY_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      active && styles.categoryChipActive
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={14}
                      color={active ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Booking / Transaction ID Input */}
            <Input
              label="Booking or Transaction ID (Optional)"
              value={referenceId}
              onChangeText={setReferenceId}
              placeholder="e.g. BK-10924 or TXN-5541"
              containerStyle={styles.inputField}
            />

            {/* Subject Input */}
            <Input
              label="Subject *"
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Wallet payout pending / Dispute on Booking #1092"
              containerStyle={styles.inputField}
            />

            {/* Description Input */}
            <Input
              label="Details of your request *"
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide full details so we can assist you quickly..."
              multiline
              numberOfLines={4}
              containerStyle={styles.inputField}
            />

            {/* Submit Button */}
            <Button
              title="Submit Ticket"
              onPress={handleSubmitTicket}
              loading={submitting}
              disabled={submitting}
              leftIcon={<Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />}
              style={styles.submitBtn}
            />
          </Card>

          {/* Frequently Asked Questions */}
          <Card style={styles.faqCard}>
            <Text style={styles.faqSectionTitle}>Provider Help & FAQs</Text>
            {PROVIDER_FAQS.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <View key={index} style={styles.faqItem}>
                  <TouchableOpacity
                    style={styles.faqQuestionRow}
                    onPress={() => setExpandedFaq(isOpen ? null : index)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.faqQuestionText}>{faq.q}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {isOpen ? (
                    <Text style={styles.faqAnswerText}>{faq.a}</Text>
                  ) : null}
                  {index < PROVIDER_FAQS.length - 1 && <View style={styles.faqDivider} />}
                </View>
              );
            })}
          </Card>

          {/* Operational Hours & Policy Note */}
          <View style={styles.policyFooter}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={styles.policyText}>
              MENDROO Partner Protection • Direct Helpline: {SUPPORT_CONFIG.DISPLAY_NUMBER}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl
    },
    formCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg
    },
    formHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg
    },
    formHeaderIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? '#2E1065' : '#EDE9FE',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md
    },
    formTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary || '#FFFFFF'
    },
    formSubtitle: {
      fontSize: 12,
      color: colors.textSecondary || '#9CA3AF',
      marginTop: 2
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary || '#FFFFFF',
      marginBottom: spacing.xs
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSecondary || (isDark ? '#1C1929' : '#F3F4F6'),
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginRight: 8,
      marginBottom: 8
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary || '#9CA3AF'
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '600'
    },
    inputField: {
      marginBottom: spacing.md
    },
    submitBtn: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary
    },
    faqCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg
    },
    faqSectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary || '#FFFFFF',
      marginBottom: spacing.md
    },
    faqItem: {
      marginBottom: 6
    },
    faqQuestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8
    },
    faqQuestionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary || '#FFFFFF',
      flex: 1,
      paddingRight: 8
    },
    faqAnswerText: {
      fontSize: 13,
      color: colors.textSecondary || '#9CA3AF',
      lineHeight: 19,
      marginTop: 4,
      marginBottom: 8
    },
    faqDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4
    },
    policyFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
      paddingHorizontal: spacing.md
    },
    policyText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary || '#9CA3AF',
      marginLeft: 6,
      textAlign: 'center'
    }
  });

