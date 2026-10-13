import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { spacing, borderRadius, typography } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: { backgroundColor: colors.secondary, borderColor: colors.secondary },
          text: { color: colors.white }
        };
      case 'outline':
        return {
          button: { backgroundColor: 'transparent', borderColor: colors.primary, borderWidth: 1.5 },
          text: { color: colors.primary }
        };
      case 'danger':
        return {
          button: { backgroundColor: colors.danger, borderColor: colors.danger },
          text: { color: colors.white }
        };
      case 'success':
        return {
          button: { backgroundColor: colors.success, borderColor: colors.success },
          text: { color: colors.white }
        };
      case 'primary':
      default:
        return {
          button: { backgroundColor: colors.primary, borderColor: colors.primary },
          text: { color: colors.white }
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          button: { paddingVertical: 6, paddingHorizontal: spacing.md },
          text: { fontSize: 13 }
        };
      case 'lg':
        return {
          button: { paddingVertical: 14, paddingHorizontal: spacing.xxl },
          text: { fontSize: 16 }
        };
      case 'md':
      default:
        return {
          button: { paddingVertical: 10, paddingHorizontal: spacing.lg },
          text: { fontSize: 14 }
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        variantStyles.button,
        sizeStyles.button,
        disabled && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? colors.primary : colors.white}
        />
      ) : (
        <Text
          style={[
            styles.baseText,
            variantStyles.text,
            sizeStyles.text,
            disabled && styles.disabledText,
            textStyle
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  baseText: {
    ...typography.button,
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.5
  },
  disabledText: {
    color: colors.slate400
  }
});
