import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme';

export const Button = ({
  title,
  onPress,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger', 'success'
  size = 'md', // 'sm', 'md', 'lg'
  isLoading = false,
  loading = false,
  disabled = false,
  leftIcon = null,
  rightIcon = null,
  style,
  textStyle
}) => {
  const isSpinning = Boolean(isLoading || loading);

  const getVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.btnSecondary;
      case 'outline':
        return styles.btnOutline;
      case 'danger':
        return styles.btnDanger;
      case 'success':
        return styles.btnSuccess;
      default:
        return styles.btnPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.textSecondary;
      case 'outline':
        return styles.textOutline;
      case 'danger':
        return styles.textDanger;
      case 'success':
        return styles.textSuccess;
      default:
        return styles.textPrimary;
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
          ? colors.slate800
          : colors.white;
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
          color={variant === 'outline' ? colors.primary : colors.white}
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
  btnPrimary: {
    backgroundColor: colors.primary
  },
  btnSecondary: {
    backgroundColor: colors.cardSecondary,
    borderWidth: 1,
    borderColor: colors.border
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  btnDanger: {
    backgroundColor: colors.danger
  },
  btnSuccess: {
    backgroundColor: colors.success
  },
  sizeSm: {
    paddingVertical: spacing.xs + 3,
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
    opacity: 0.5
  },
  text: {
    fontWeight: '600',
    fontSize: 14
  },
  textPrimary: {
    color: colors.white
  },
  textSecondary: {
    color: colors.slate800
  },
  textOutline: {
    color: colors.primaryLight
  },
  textDanger: {
    color: colors.white
  },
  textSuccess: {
    color: colors.white
  },
  iconLeft: {
    marginRight: spacing.sm
  },
  iconRight: {
    marginLeft: spacing.sm
  }
});

export default Button;
