import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  PLATFORM_NAME,
  COUNTRY,
  TERMS_HASH,
  TERMS_SECTIONS
} from '../../constants/providerTerms';
import { spacing, typography, borderRadius } from '../../theme';

export default function ProviderTermsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { profile } = useAuth();

  const isAccepted = profile?.acceptedTermsVersion === CURRENT_TERMS_VERSION;
  const acceptedDate = profile?.acceptedTermsAt
    ? new Date(profile.acceptedTermsAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          {navigation?.canGoBack() && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Terms & Conditions</Text>
            <Text style={styles.headerSub}>Service Provider Agreement</Text>
          </View>
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
        {/* Document Metadata Banner */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.platformBadge}>
              <Text style={styles.platformBadgeText}>{PLATFORM_NAME}</Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>v{CURRENT_TERMS_VERSION}</Text>
            </View>
          </View>
          <Text style={styles.docTitle}>TERMS & CONDITIONS FOR SERVICE PROVIDERS</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text style={styles.dateText}>Effective Date: {TERMS_EFFECTIVE_DATE}</Text>
          </View>

          {isAccepted ? (
            <View style={styles.acceptedBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.acceptedBannerText}>
                You accepted this agreement on {acceptedDate}
              </Text>
            </View>
          ) : (
            <View style={styles.pendingBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={styles.pendingBannerText}>
                Binding agreement for all registered service partners.
              </Text>
            </View>
          )}

          <Text style={styles.introParagraph}>
            Welcome to {PLATFORM_NAME}! By registering as a Service Provider on the {PLATFORM_NAME} platform, you agree to follow the terms and conditions mentioned below.
          </Text>
        </View>

        {/* 15 Verbatim Sections */}
        {TERMS_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {/* Standard Numbered Clauses */}
            {Array.isArray(section.clauses) && section.clauses.map((clause, idx) => (
              <View key={idx} style={styles.clauseRow}>
                <Text style={styles.clauseNumber}>{idx + 1}.</Text>
                <Text style={styles.clauseText}>{clause}</Text>
              </View>
            ))}

            {/* Section 10: Suspension & Termination */}
            {section.intro && (
              <Text style={styles.sectionIntro}>{section.intro}</Text>
            )}

            {Array.isArray(section.bullets) && section.bullets.map((bullet, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}

            {section.closing && (
              <Text style={styles.sectionClosing}>{section.closing}</Text>
            )}

            {/* Standard Paragraph Text (Sections 13 & 14) */}
            {section.text && (
              <Text style={styles.sectionParagraph}>{section.text}</Text>
            )}

            {/* Section 15: Tagline & Footer */}
            {section.tagline && (
              <View style={styles.taglineBox}>
                <Text style={styles.taglineText}>{section.tagline}</Text>
                {section.footer && (
                  <Text style={styles.taglineFooter}>{section.footer}</Text>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Legal Integrity Footer */}
        <View style={styles.integrityCard}>
          <View style={styles.integrityHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#A78BFA" />
            <Text style={styles.integrityTitle}>Document Verification & Integrity</Text>
          </View>
          <Text style={styles.integrityHashLabel}>Canonical SHA-256 Checksum:</Text>
          <Text style={styles.integrityHashValue} selectable>{TERMS_HASH}</Text>
          <Text style={styles.integrityNote}>
            Jurisdiction: {COUNTRY}. Standard Platform Agreement for Verified Service Partners.
          </Text>
        </View>
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
  backBtn: {
    marginRight: spacing.md,
    padding: 4
  },
  headerTitleWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.md
  },
  metaCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  platformBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm
  },
  platformBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  versionBadge: {
    backgroundColor: isDark ? '#1F2937' : colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm
  },
  versionBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600'
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
    marginVertical: spacing.xs
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#DCFCE7',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#86EFAC',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 8,
    marginBottom: spacing.md
  },
  acceptedBannerText: {
    fontSize: 12,
    color: isDark ? '#34D399' : '#15803D',
    fontWeight: '600',
    flex: 1
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FEF3C7',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 8,
    marginBottom: spacing.md
  },
  pendingBannerText: {
    fontSize: 12,
    color: isDark ? '#FBBF24' : '#B45309',
    fontWeight: '500',
    flex: 1
  },
  introParagraph: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingVertical: 2
  },
  clauseNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 22,
    marginTop: 1
  },
  clauseText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary
  },
  sectionIntro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
    marginBottom: spacing.xs
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: spacing.sm
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 8
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary
  },
  sectionClosing: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs
  },
  sectionParagraph: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary
  },
  taglineBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center'
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    fontStyle: 'italic',
    marginBottom: 4
  },
  taglineFooter: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16
  },
  integrityCard: {
    backgroundColor: isDark ? '#121217' : colors.cardSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm
  },
  integrityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs
  },
  integrityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  integrityHashLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4
  },
  integrityHashValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    color: colors.primary,
    backgroundColor: isDark ? '#0B0B0E' : colors.card,
    padding: 6,
    borderRadius: 4,
    marginVertical: 4
  },
  integrityNote: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14
  }
});