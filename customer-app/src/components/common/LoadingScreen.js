import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';

export default function LoadingScreen({ message = 'Loading...', fullScreen = true }) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background
  },
  message: {
    ...typography.bodyMedium,
    color: colors.slate500,
    marginTop: spacing.md
  }
});
