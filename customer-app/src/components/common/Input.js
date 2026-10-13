import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme';

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
  ...props
}) => {
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
          color={isFocused ? colors.primary : colors.slate400}
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
            color={colors.slate400}
          />
        </TouchableOpacity>
      );
    }

    if (!rightIcon) return null;

    const iconNode =
      typeof rightIcon === 'string' ? (
        <Ionicons name={rightIcon} size={20} color={colors.slate400} />
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
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focusedInput,
          Boolean(error) && styles.errorInput,
          !editable && styles.disabledInput
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle
          ]}
          {...props}
        />

        {renderRightIcon()}
      </View>

      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
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
    color: '#E2E8F0',
    marginBottom: spacing.xs + 2
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161420',
    borderWidth: 1.5,
    borderColor: '#252136',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md
  },
  focusedInput: {
    borderColor: '#7C3AED',
    backgroundColor: '#1C1929'
  },
  errorInput: {
    borderColor: colors.danger,
    backgroundColor: '#4C0519'
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: '#27272A'
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    fontSize: 15,
    color: '#FFFFFF'
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  leftIconContainer: {
    marginRight: spacing.sm
  },
  eyeIcon: {
    padding: spacing.xs
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
    fontWeight: '500'
  }
});

export default Input;
