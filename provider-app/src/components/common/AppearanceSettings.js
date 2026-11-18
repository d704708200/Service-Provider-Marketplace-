import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../theme';

const THEME_OPTIONS = [
  {
    mode: 'dark',
    label: 'Dark Mode',
    sublabel: 'Always dark theme',
    icon: 'moon'
  },
  {
    mode: 'light',
    label: 'Light Mode',
    sublabel: 'Always light theme',
    icon: 'sunny'
  },
  {
    mode: 'system',
    label: 'System Default',
    sublabel: 'Match device settings',
    icon: 'phone-portrait-outline'
  }
];

export default function AppearanceSettings({ style }) {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(124, 58, 237, 0.20)' : 'rgba(124, 58, 237, 0.10)' }]}>
          <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Appearance</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Choose your preferred interface theme
          </Text>
        </View>
      </View>

      <View style={styles.optionsRow}>
        {THEME_OPTIONS.map((opt) => {
          const isSelected = themeMode === opt.mode;

          return (
            <TouchableOpacity
              key={opt.mode}
              activeOpacity={0.7}
              onPress={() => setThemeMode(opt.mode)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected
                    ? (isDark ? '#261B44' : '#EDE9FE')
                    : colors.cardSecondary,
                  borderColor: isSelected ? colors.primary : colors.border
                }
              ]}
            >
              <View
                style={[
                  styles.optionIconBox,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : (isDark ? '#201D2C' : '#E3E5EF')
                  }
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                />
              </View>

              <Text
                style={[
                  styles.optionLabel,
                  {
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontWeight: isSelected ? '700' : '600'
                  }
                ]}
                numberOfLines={1}
              >
                {opt.label.replace(' Mode', '')}
              </Text>

              {isSelected && (
                <View style={[styles.selectedCheckBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTextCol: {
    flex: 1
  },
  title: {
    fontSize: 15,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  optionCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  optionLabel: {
    fontSize: 12,
    textAlign: 'center'
  },
  selectedCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
