import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { spacing, borderRadius, typography } from '../../theme';

export default function Badge({
  label,
  variant = 'primary', // primary, success, warning, danger, slate, secondary
  size = 'md', // sm, md
  style,
  textStyle
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: '#064E3B',
          text: '#34D399'
        };
      case 'warning':
        return {
          bg: '#451A03',
          text: '#FBBF24'
        };
      case 'danger':
        return {
          bg: '#4C0519',
          text: '#F87171'
        };
      case 'secondary':
        return {
          bg: '#2E1065',
          text: '#C084FC'
        };
      case 'slate':
        return {
          bg: '#252136',
          text: '#9CA3AF'
        };
      case 'primary':
      default:
        return {
          bg: '#2E1065',
          text: '#A78BFA'
        };
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
