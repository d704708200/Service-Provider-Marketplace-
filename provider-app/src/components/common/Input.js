import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../theme';

export const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  leftIcon = null,
  rightIcon = null,
  onRightIconPress = null,
  containerStyle,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  style,
  inputStyle,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}) => {
  const { colors, isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isPassword = secureTextEntry;

  const renderLeftIcon = () => {
    if (!leftIcon) return null;
    if (typeof leftIcon === 'string') {
      return (
        <Ionicons
          name={leftIcon}
          size={20}
          color={isFocused ? colors.primary : colors.placeholder}
        />
      );
    }
    return leftIcon;
  };

  const renderRightIcon = () => {
    if (isPassword) {
      return (
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.placeholder}
          />
        </TouchableOpacity>
      );
    }

    if (!rightIcon) return null;

    const iconNode =
      typeof rightIcon === 'string' ? (
        <Ionicons name={rightIcon} size={20} color={colors.placeholder} />
      ) : (
        rightIcon
      );

    if (onRightIconPress) {
      return (
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={onRightIconPress}
          activeOpacity={0.7}
        >
          {iconNode}
        </TouchableOpacity>
      );
    }

    return <View style={styles.eyeIcon}>{iconNode}</View>;
  };

  return (
    <View style={[styles.container, containerStyle, style]}>
      {label && <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border
          },
          isFocused && {
            borderColor: colors.primary,
            backgroundColor: isDark ? colors.cardSecondary : '#FFFFFF'
          },
          Boolean(error) && {
            borderColor: colors.danger,
            backgroundColor: isDark ? colors.dangerSubtle : '#FEF2F2'
          },
          !editable && {
            opacity: 0.6,
            backgroundColor: colors.disabled
          }
        ]}
      >
        {Boolean(leftIcon) && (
          <View style={styles.leftIconContainer}>{renderLeftIcon()}</View>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={isPassword && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={(e) => {
            setIsFocused(true);
            onFocusProp?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlurProp?.(e);
          }}
          style={[
            styles.input,
            { color: colors.textPrimary },
            multiline && styles.multilineInput,
            inputStyle
          ]}
          {...props}
        />

        {renderRightIcon()}
      </View>

      {Boolean(error) && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs + 2
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none'
        }
      : {})
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm + 4
  },
  leftIconContainer: {
    marginRight: spacing.sm
  },
  eyeIcon: {
    padding: spacing.xs
  },
  errorText: {
    fontSize: 12,
    marginTop: spacing.xs,
    fontWeight: '500'
  }
});

export default Input;
