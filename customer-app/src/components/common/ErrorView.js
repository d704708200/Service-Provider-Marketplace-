import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';
import Button from './Button';

export default function ErrorView({
  title = 'Something Went Wrong',
  message = 'We could not connect to the server. Please check your connection and try again.',
  onRetry,
  containerStyle
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
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
    backgroundColor: colors.dangerSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg
  },
  title: {
    ...typography.titleSmall,
    color: colors.slate900,
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  message: {
    ...typography.bodyMedium,
    color: colors.slate600,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg
  },
  retryButton: {
    minWidth: 140
  }
});
