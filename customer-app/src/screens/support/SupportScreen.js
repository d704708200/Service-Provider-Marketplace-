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

const COMPLAINT_CATEGORIES = [
  { id: 'booking', label: 'Booking Issue', icon: 'calendar-outline' },
  { id: 'quality', label: 'Service Quality', icon: 'star-half-outline' },
  { id: 'payment', label: 'Payment / Refund', icon: 'card-outline' },
  { id: 'provider', label: 'Provider Conduct', icon: 'person-outline' },
  { id: 'other', label: 'Other Inquiry', icon: 'chatbox-ellipses-outline' }
];

const FAQS = [
  {
    q: 'How do I reach emergency or instant support?',
    a: `You can directly call our official MENDROO helpline at ${SUPPORT_CONFIG.DISPLAY_NUMBER} Monday through Saturday between 8:00 AM and 8:00 PM IST.`
  },
  {
    q: 'How long does complaint resolution take?',
    a: 'Critical complaints are acknowledged immediately. Our operations team reviews and responds to all tickets within 2 to 4 business hours.'
  },
  {
    q: 'What if a service was unsatisfactory or incomplete?',
    a: 'Please file a complaint below with your Booking ID. MENDROO offers complete dispute mediation and service warranty protection.'
  }
];

export default function SupportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [selectedCategory, setSelectedCategory] = useState('booking');
  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSubmitComplaint = () => {
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a brief subject for your complaint.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Details', 'Please provide a detailed description of the issue.');
      return;
    }

    setSubmitting(true);

    // Simulate reliable ticket creation with ticket number
    setTimeout(() => {
      setSubmitting(false);
      const ticketId = `CMP-${Date.now().toString().slice(-6)}`;
      Alert.alert(
        'Complaint Submitted',
        `Your support request #${ticketId} has been registered.\n\nOur customer care team will review your ticket and contact you. For urgent inquiries, call our helpline at ${SUPPORT_CONFIG.DISPLAY_NUMBER}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSubject('');
              setDescription('');
              setBookingId('');
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
        subtitle="Customer Service & Complaints"
        showBack={Boolean(navigation?.canGoBack())}
        onBack={() => navigation?.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Official Phone Helpline Card */}
          <SupportContactCard />

          {/* Complaint / Dispute Submission Form */}
          <Card style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View style={styles.formHeaderIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>File a Complaint / Report Issue</Text>
                <Text style={styles.formSubtitle}>
                  Submit your issue and our operations team will resolve it.
                </Text>
              </View>
            </View>

            {/* Category Selector */}
            <Text style={styles.inputLabel}>Category *</Text>
            <View style={styles.categoryRow}>
              {COMPLAINT_CATEGORIES.map((cat) => {
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

            {/* Booking ID Input */}
            <Input
              label="Booking Reference ID (Optional)"
              value={bookingId}
              onChangeText={setBookingId}
              placeholder="e.g. BK-98721 or MongoDB ID"
              containerStyle={styles.inputField}
            />

            {/* Subject Input */}
            <Input
              label="Subject *"
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Provider arrived late / Incorrect charges"
              containerStyle={styles.inputField}
            />

            {/* Description Input */}
            <Input
              label="Describe the Issue in Detail *"
              value={description}
              onChangeText={setDescription}
              placeholder="Explain what happened, including date, time, and service details..."
              multiline
              numberOfLines={4}
              containerStyle={styles.inputField}
            />

            {/* Submit Button */}
            <Button
              title="Submit Complaint"
              onPress={handleSubmitComplaint}
              loading={submitting}
              disabled={submitting}
              leftIcon={<Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />}
              style={styles.submitBtn}
            />
          </Card>

          {/* Frequently Asked Questions */}
          <Card style={styles.faqCard}>
            <Text style={styles.faqSectionTitle}>Frequently Asked Questions</Text>
            {FAQS.map((faq, index) => {
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
                  {index < FAQS.length - 1 && <View style={styles.faqDivider} />}
                </View>
              );
            })}
          </Card>

          {/* Operational Hours & Policy Note */}
          <View style={styles.policyFooter}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
            <Text style={styles.policyText}>
              MENDROO Verified Customer Protection • Helpline: {SUPPORT_CONFIG.DISPLAY_NUMBER}
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
