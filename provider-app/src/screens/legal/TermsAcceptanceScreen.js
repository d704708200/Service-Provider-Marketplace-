import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  PLATFORM_NAME,
  TERMS_HASH,
  TERMS_SECTIONS
} from '../../constants/providerTerms';
import { spacing, typography, borderRadius } from '../../theme';

export default function TermsAcceptanceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { acceptTerms, logout, error: authError } = useAuth();

  const [hasAgreed, setHasAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleAccept = async () => {
    if (!hasAgreed) {
      setLocalError('You must explicitly agree to the Terms & Conditions before proceeding.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);

    try {
      const res = await acceptTerms();
      if (!res?.success) {
        setLocalError(res?.error || 'Failed to record acceptance. Please try again.');
      }
      // On success, AuthContext sets requiresTermsAcceptance: false,
      // which automatically transitions RootNavigator to MainTabs.
    } catch (err) {
      setLocalError(err.message || 'An unexpected error occurred while accepting terms.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to accept the updated Terms & Conditions upon next login to access your provider dashboard.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>{PLATFORM_NAME}</Text>
          </View>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Terms & Conditions Update</Text>
            <Text style={styles.headerSub}>Action required to continue</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutHeaderBtn}
            onPress={handleLogout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xl * 2 }
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Important Notice Banner */}
        <View style={styles.noticeCard}>
          <Ionicons name="shield-alert" size={24} color="#A78BFA" style={{ marginTop: 2 }} />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Updated Service Agreement</Text>
            <Text style={styles.noticeDesc}>
              {PLATFORM_NAME} has published updated Terms & Conditions for all registered Service Providers (Effective Date: {TERMS_EFFECTIVE_DATE}). Please review and accept these terms to continue receiving bookings and managing your account.
            </Text>
          </View>
        </View>

        {/* View Full Document Link */}
        <TouchableOpacity
          style={styles.fullDocBtn}
          onPress={() => navigation?.navigate('ProviderTerms')}
          activeOpacity={0.8}
        >
          <View style={styles.fullDocLeft}>
            <Ionicons name="document-text-outline" size={20} color="#A78BFA" />
            <Text style={styles.fullDocText}>Read Full Document in Dedicated Viewer</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Inline Terms Document Viewer */}
        <View style={styles.termsBox}>
          <View style={styles.termsBoxHeader}>
            <Text style={styles.termsBoxTitle}>SUMMARY & CLAUSES (v{CURRENT_TERMS_VERSION})</Text>
            <Text style={styles.termsBoxDate}>Effective: {TERMS_EFFECTIVE_DATE}</Text>
          </View>

          <Text style={styles.welcomeIntro}>
            Welcome to {PLATFORM_NAME}! By registering as a Service Provider on the {PLATFORM_NAME} platform, you agree to follow the terms and conditions mentioned below.
          </Text>

          {TERMS_SECTIONS.map((section) => (
            <View key={section.id} style={styles.innerSection}>
              <Text style={styles.innerSectionTitle}>{section.title}</Text>

              {Array.isArray(section.clauses) && section.clauses.map((clause, idx) => (
                <View key={idx} style={styles.innerClauseRow}>
                  <Text style={styles.innerClauseNum}>{idx + 1}.</Text>
                  <Text style={styles.innerClauseText}>{clause}</Text>
                </View>
              ))}

              {section.intro && (
                <Text style={styles.innerIntro}>{section.intro}</Text>
              )}

              {Array.isArray(section.bullets) && section.bullets.map((b, idx) => (
                <View key={idx} style={styles.innerBulletRow}>
                  <View style={styles.innerDot} />
                  <Text style={styles.innerBulletText}>{b}</Text>
                </View>
              ))}

              {section.closing && (
                <Text style={styles.innerClosing}>{section.closing}</Text>
              )}

              {section.text && (
                <Text style={styles.innerText}>{section.text}</Text>
              )}

              {section.tagline && (
                <View style={styles.innerTaglineBox}>
                  <Text style={styles.innerTagline}>{section.tagline}</Text>
                  {section.footer && (
                    <Text style={styles.innerFooter}>{section.footer}</Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Error Banners */}
        {(localError || authError) && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{localError || authError}</Text>
          </View>
        )}

        {/* Mandatory Agreement Checkbox */}
        <TouchableOpacity
          style={[styles.checkboxContainer, hasAgreed && styles.checkboxContainerActive]}
          onPress={() => {
            setHasAgreed(!hasAgreed);
            if (localError) setLocalError(null);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, hasAgreed && styles.checkboxActive]}>
            {hasAgreed && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read, understood and agree to the {PLATFORM_NAME} Service Provider Terms & Conditions.
          </Text>
        </TouchableOpacity>

        {/* Acceptance Action Button */}
        <TouchableOpacity
          style={[
            styles.acceptBtn,
            (!hasAgreed || submitting) && styles.acceptBtnDisabled
          ]}
          onPress={handleAccept}
          disabled={!hasAgreed || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.acceptBtnText}>I AGREE & ACCEPT</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Secondary Sign Out Button */}
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.declineBtnText}>Decline and Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5
  },
  headerTitleWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  signOutHeaderBtn: {
    padding: 6
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.md
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1A1828' : colors.cardSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  noticeContent: {
    flex: 1
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  noticeDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary
  },
  fullDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  fullDocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  fullDocText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  termsBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    maxHeight: 380
  },
  termsBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm
  },
  termsBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5
  },
  termsBoxDate: {
    fontSize: 11,
    color: colors.textMuted
  },
  welcomeIntro: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
    marginBottom: spacing.sm
  },
  innerSection: {
    marginBottom: spacing.md
  },
  innerSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6
  },
  innerClauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  innerClauseNum: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 20,
    fontWeight: '600'
  },
  innerClauseText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17
  },
  innerIntro: {
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 4
  },
  innerBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 6
  },
  innerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 6
  },
  innerBulletText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17
  },
  innerClosing: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2
  },
  innerText: {
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 17
  },
  innerTaglineBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  innerTagline: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    fontStyle: 'italic'
  },
  innerFooter: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 8
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    flex: 1
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg
  },
  checkboxContainerActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? '#191724' : '#F5F3FF'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
    fontWeight: '500'
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  acceptBtnDisabled: {
    backgroundColor: isDark ? '#374151' : '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  declineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  declineBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500'
  }
});