import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../theme';

export default function Card({
  children,
  style,
  onPress,
  elevated = false,
  bordered = true,
  ...props
}) {
  const { colors, theme } = useTheme();

  const cardStyles = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border
    },
    bordered && styles.bordered,
    elevated ? theme.shadows.elevated : theme.shadows.card,
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
    borderRadius: borderRadius.lg,
    padding: spacing.lg
  },
  bordered: {
    borderWidth: 1
  }
});
