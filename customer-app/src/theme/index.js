import colors, { COLORS } from './colors.js';

export { colors, COLORS };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const typography = {
  titleLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.slate900,
    letterSpacing: -0.5
  },
  titleMedium: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.slate900,
    letterSpacing: -0.3
  },
  titleSmall: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.slate900
  },
  bodyLarge: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.slate700,
    lineHeight: 22
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.slate600,
    lineHeight: 20
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.slate500,
    lineHeight: 16
  },
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.slate400
  },
  button: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white
  }
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999
};

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  elevated: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  }
};

export const theme = {
  colors,
  COLORS: colors,
  spacing,
  typography,
  borderRadius,
  shadows
};

export default theme;
