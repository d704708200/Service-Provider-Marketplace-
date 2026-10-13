import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { spacing, borderRadius } from '../../theme';

export default function Badge({ label, variant = 'primary', size = 'md', style }) {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successSubtle, text: colors.success };
      case 'warning':
        return { bg: colors.warningSubtle, text: colors.warning };
      case 'danger':
        return { bg: colors.dangerSubtle, text: colors.danger };
      case 'secondary':
        return { bg: colors.secondarySubtle, text: colors.secondary };
      case 'slate':
        return { bg: colors.slate100, text: colors.slate600 };
      case 'primary':
      default:
        return { bg: colors.primarySubtle, text: colors.primary };
    }
  };

  const c = getColors();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        isSm ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: c.bg },
        style
      ]}
    >
      <Text style={[styles.text, isSm ? styles.textSm : styles.textMd, { color: c.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
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
    fontWeight: '700'
  },
  textSm: {
    fontSize: 10
  },
  textMd: {
    fontSize: 12
  }
});
