import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SUPPORT_CONFIG } from '../../constants/support';
import { callPhoneNumber } from '../../utils/phoneUtils';
import { spacing, borderRadius } from '../../theme';
import Button from './Button';

/**
 * Professional Support Contact Card for MENDROO Provider Portal
 * Displays official support number +91 89277 21577 with one-tap dialing and selectable text.
 */
export default function SupportContactCard({
  style,
  title = SUPPORT_CONFIG.NAME,
  displayNumber = SUPPORT_CONFIG.DISPLAY_NUMBER,
  hours = SUPPORT_CONFIG.HOURS,
  email = SUPPORT_CONFIG.EMAIL,
  showEmail = true,
  onPressCall
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const handleCall = async () => {
    if (typeof onPressCall === 'function') {
      return onPressCall();
    }
    await callPhoneNumber(displayNumber, title);
  };

  const handleEmail = async () => {
    if (!email) return;
    const mailto = `mailto:${email}?subject=${encodeURIComponent('MENDROO Provider Support Request')}`;
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') {
        await Linking.openURL(mailto);
      } else {
        Alert.alert('Email Support', `Please email us at: ${email}`);
      }
    } catch (_) {
      Alert.alert('Email Support', `Please email us at: ${email}`);
    }
  };

  return (
    <View style={[styles.card, style]}>
      {/* Header with Brand Icon and Official Badge */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="headset" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.brandTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.supportBadgeText}>
            Official Helpline
          </Text>
        </View>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusPillText}>Provider Care</Text>
        </View>
      </View>

      {/* Main Phone Number Display */}
      <View style={styles.phoneSection}>
        <Text style={styles.phoneLabel}>Helpline Number</Text>
        <View style={styles.numberRow}>
          <Ionicons name="call" size={22} color={colors.primary} style={styles.callIcon} />
          <Text
            style={styles.phoneNumber}
            selectable={true}
            accessibilityRole="text"
            accessibilityLabel={`Customer Support Phone Number: ${displayNumber}`}
          >
            {displayNumber}
          </Text>
        </View>
        {hours ? (
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.hoursText}>{hours}</Text>
          </View>
        ) : null}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <Button
          title={SUPPORT_CONFIG.CALL_BUTTON_LABEL}
          onPress={handleCall}
          leftIcon={<Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />}
          style={styles.callButton}
          variant="primary"
        />

        {showEmail && email ? (
          <TouchableOpacity
            style={styles.emailRow}
            onPress={handleEmail}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Send email to ${email}`}
          >
            <Ionicons name="mail-outline" size={15} color={colors.primary} />
            <Text style={styles.emailText}>Email: {email}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors, isDark) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.15 : 0.08,
      shadowRadius: 8,
      elevation: 2
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md
    },
    headerTextCol: {
      flex: 1,
      justifyContent: 'center'
    },
    brandTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary || '#FFFFFF',
      letterSpacing: -0.2
    },
    supportBadgeText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary || '#9CA3AF',
      marginTop: 2
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0'
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
      marginRight: 5
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#10B981'
    },
    phoneSection: {
      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.08)' : '#F5F3FF',
      borderColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#DDD6FE',
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md
    },
    phoneLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.textSecondary || '#9CA3AF',
      marginBottom: 4
    },
    numberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6
    },
    callIcon: {
      marginRight: 8
    },
    phoneNumber: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.primary || '#7C3AED'
    },
    hoursRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2
    },
    hoursText: {
      fontSize: 12,
      color: colors.textSecondary || '#9CA3AF',
      marginLeft: 6
    },
    actionContainer: {
      width: '100%'
    },
    callButton: {
      width: '100%',
      backgroundColor: colors.primary || '#7C3AED',
      borderRadius: borderRadius.md || 10,
      paddingVertical: 12
    },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      paddingVertical: 4
    },
    emailText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary || '#9CA3AF',
      marginLeft: 6,
      textDecorationLine: 'underline'
    }
  });

