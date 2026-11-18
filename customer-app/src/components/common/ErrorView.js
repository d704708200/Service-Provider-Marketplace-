import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import Button from './Button';

export default function ErrorView({
  title = 'Something Went Wrong',
  message = 'We could not connect to the server. Please check your connection and try again.',
  onRetry,
  containerStyle
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSubtle }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="primary"
          size="sm"
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg
  },
  title: {
    ...typography.titleSmall,
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  message: {
    ...typography.bodyMedium,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg
  },
  retryButton: {
    minWidth: 140
  }
});
