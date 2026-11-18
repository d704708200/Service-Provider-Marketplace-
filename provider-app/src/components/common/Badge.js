import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../theme';

export default function Badge({
  label,
  variant = 'primary', // primary, success, warning, danger, slate, secondary
  size = 'md', // sm, md
  style,
  textStyle
}) {
  const { isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return isDark
          ? { bg: '#064E3B', text: '#34D399' }
          : { bg: '#D1FAE5', text: '#065F46' };
      case 'warning':
        return isDark
          ? { bg: '#451A03', text: '#FBBF24' }
          : { bg: '#FEF3C7', text: '#92400E' };
      case 'danger':
        return isDark
          ? { bg: '#4C0519', text: '#F87171' }
          : { bg: '#FEE2E2', text: '#991B1B' };
      case 'secondary':
        return isDark
          ? { bg: '#2E1065', text: '#C084FC' }
          : { bg: '#F3E8FF', text: '#6B21A8' };
      case 'slate':
        return isDark
          ? { bg: '#252136', text: '#9CA3AF' }
          : { bg: '#F1F2F8', text: '#475569' };
      case 'primary':
      default:
        return isDark
          ? { bg: '#2E1065', text: '#A78BFA' }
          : { bg: '#EDE9FE', text: '#6D28D9' };
    }
  };

  const currentVariant = getVariantStyles();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: currentVariant.bg },
        style
      ]}
    >
      <Text
        style={[
          styles.text,
          isSm ? styles.textSm : styles.textMd,
          { color: currentVariant.text },
          textStyle
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  text: {
    fontWeight: '600'
  },
  textSm: {
    fontSize: 11
  },
  textMd: {
    fontSize: 12
  }
});
