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
          bg: colors.successSubtle,
          text: colors.success
        };
      case 'warning':
        return {
          bg: colors.warningSubtle,
          text: colors.warning
        };
      case 'danger':
        return {
          bg: colors.dangerSubtle,
          text: colors.danger
        };
      case 'secondary':
        return {
          bg: colors.secondarySubtle,
          text: colors.secondary
        };
      case 'slate':
        return {
          bg: colors.slate100,
          text: colors.slate600
        };
      case 'primary':
      default:
        return {
          bg: colors.primarySubtle,
          text: colors.primary
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
