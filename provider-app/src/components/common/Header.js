import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';

export default function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightComponent,
  containerStyle
}) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={colors.slate900} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {rightComponent && <View style={styles.rightContainer}>{rightComponent}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  leftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs
  },
  titleContainer: {
    flex: 1
  },
  title: {
    ...typography.titleMedium,
    color: colors.slate900
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.slate500,
    marginTop: 2
  },
  rightContainer: {
    marginLeft: spacing.md
  }
});
