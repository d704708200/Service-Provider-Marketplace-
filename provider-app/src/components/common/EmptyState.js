import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
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
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.cardSecondary }]}>
        <Ionicons name={icon} size={40} color={colors.placeholder} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
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
  description: {
    ...typography.bodyMedium,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg
  },
  actionButton: {
    minWidth: 140
  }
});
