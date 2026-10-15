import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';
import Button from './Button';

export default function EmptyState({
  icon = 'file-tray-outline',
  title = 'No Items Found',
  description = 'There are no items to display at this time.',
  actionTitle,
  onAction,
  containerStyle
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={38} color="#A78BFA" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="outline"
          size="sm"
          style={styles.actionButton}
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1E1B2E',
    borderWidth: 1,
    borderColor: '#2F264A',
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
  description: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: spacing.lg
  },
  actionButton: {
    minWidth: 140
  }
});
