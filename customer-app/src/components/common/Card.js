import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme';

export default function Card({
  children,
  style,
  onPress,
  elevated = false,
  bordered = true,
  ...props
}) {
  const cardStyles = [
    styles.card,
    bordered && styles.bordered,
    elevated && shadows.elevated,
    style
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyles}
        onPress={onPress}
        activeOpacity={0.7}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyles} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.card
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border
  }
});
