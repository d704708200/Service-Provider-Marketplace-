import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';
import Button from './Button';

export default function ErrorView({
  title = 'Something Went Wrong',
  message = 'We could not connect to the server. Please try again.',
  onRetry
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={38} color="#F87171" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} variant="primary" size="sm" style={styles.btn} />
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#35111B',
    borderWidth: 1,
    borderColor: '#541525',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg
  },
  title: {
    ...typography.titleSmall,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.xs
  },
  message: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: spacing.lg
  },
  btn: {
    minWidth: 140
  }
});
