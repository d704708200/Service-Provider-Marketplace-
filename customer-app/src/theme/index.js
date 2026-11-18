import { Platform } from 'react-native';
import colors, { COLORS, darkColors, lightColors, getThemeColors } from './colors.js';

export { colors, COLORS, darkColors, lightColors, getThemeColors };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700'
};

export const getTypography = (currentColors) => ({
  fontSize,
  fontWeight,
  titleLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: currentColors.textPrimary,
    letterSpacing: -0.5
  },
  titleMedium: {
    fontSize: 20,
    fontWeight: '700',
    color: currentColors.textPrimary,
    letterSpacing: -0.3
  },
  titleSmall: {
    fontSize: 17,
    fontWeight: '600',
    color: currentColors.textPrimary
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: '400',
    color: currentColors.textSecondary,
    lineHeight: 22
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    color: currentColors.textSecondary,
    lineHeight: 20
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: currentColors.textMuted,
    lineHeight: 16
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: currentColors.textMuted
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF'
  }
});

export const typography = getTypography(darkColors);

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999
};

export const getShadows = (isDark = true) => ({
  card: Platform.select({
    web: {
      boxShadow: isDark
        ? '0px 2px 8px rgba(0, 0, 0, 0.40)'
        : '0px 2px 8px rgba(23, 23, 37, 0.06)'
    },
    default: {
      shadowColor: isDark ? '#000000' : '#171725',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.35 : 0.06,
      shadowRadius: 8,
      elevation: 2
    }
  }),
  elevated: Platform.select({
    web: {
      boxShadow: isDark
        ? '0px 4px 14px rgba(0, 0, 0, 0.55)'
        : '0px 4px 14px rgba(23, 23, 37, 0.10)'
    },
    default: {
      shadowColor: isDark ? '#000000' : '#171725',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.5 : 0.10,
      shadowRadius: 12,
      elevation: 4
    }
  })
});

export const shadows = getShadows(true);

export const getTheme = (isDark = true) => {
  const currentColors = getThemeColors(isDark);
  return {
    isDark,
    colors: currentColors,
    COLORS: currentColors,
    spacing,
    typography: getTypography(currentColors),
    fontSize,
    fontWeight,
    borderRadius,
    shadows: getShadows(isDark)
  };
};

export const theme = {
  colors: darkColors,
  COLORS: darkColors,
  spacing,
  typography,
  fontSize,
  fontWeight,
  borderRadius,
  shadows
};

export default theme;
