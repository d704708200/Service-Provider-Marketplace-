import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { spacing, typography } from '../../theme';

export default function LoadingScreen({ message = 'Loading...', fullScreen = true }) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color="#7C3AED" />
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
    backgroundColor: '#0B0B0E'
  },
  message: {
    ...typography.bodyMedium,
    color: '#9CA3AF',
    marginTop: spacing.md
  }
});
