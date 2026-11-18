import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../theme';

export const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  isLoading = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  style,
  textStyle
}) => {
  const { colors, isDark } = useTheme();
  const isSpinning = Boolean(isLoading || loading);

  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.cardSecondary,
          borderWidth: 1,
          borderColor: colors.border
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary
        };
      case 'danger':
        return {
          backgroundColor: colors.danger
        };
      default:
        return {
          backgroundColor: colors.primary
        };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return { color: colors.textPrimary };
      case 'outline':
        return { color: colors.primary };
      case 'danger':
        return { color: '#FFFFFF' };
      default:
        return { color: '#FFFFFF' };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  const renderIcon = (icon) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      const iconColor =
        variant === 'outline'
          ? colors.primary
          : variant === 'secondary'
          ? colors.textPrimary
          : '#FFFFFF';
      const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
      return <Ionicons name={icon} size={iconSize} color={iconColor} />;
    }
    return icon;
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || isSpinning}
      style={[
        styles.button,
        getVariantStyle(),
        getSizeStyle(),
        (disabled || isSpinning) && styles.disabled,
        style
      ]}
    >
      {isSpinning ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? colors.primary : '#FFFFFF'}
        />
      ) : (
        <View style={styles.contentRow}>
          {Boolean(leftIcon) && (
            <View style={styles.iconLeft}>{renderIcon(leftIcon)}</View>
          )}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
          {Boolean(rightIcon) && (
            <View style={styles.iconRight}>{renderIcon(rightIcon)}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sizeSm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md
  },
  sizeMd: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg
  },
  sizeLg: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl
  },
  disabled: {
    opacity: 0.55
  },
  text: {
    fontWeight: '600',
    fontSize: 15
  },
  iconLeft: {
    marginRight: spacing.sm
  },
  iconRight: {
    marginLeft: spacing.sm
  }
});

export default Button;
