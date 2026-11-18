export const darkColors = {
  // Brand Accents
  primary: '#7C3AED', // Vibrant purple accent (Figma primary)
  primaryLight: '#8B5CF6', // Purple 500
  primaryDark: '#5B21B6', // Purple 800
  primarySubtle: '#2E1065', // Dark purple subtle background

  secondary: '#A78BFA', // Purple 400
  secondarySubtle: '#1E1B4B',

  // Status Colors
  success: '#10B981', // Emerald 500
  successLight: '#34D399',
  successSubtle: '#064E3B',

  warning: '#F59E0B', // Amber 500
  warningLight: '#FBBF24',
  warningSubtle: '#451A03',

  danger: '#EF4444', // Rose 500
  dangerSubtle: '#4C0519',
  error: '#EF4444',

  // Surfaces & Backgrounds
  background: '#0B0B0E', // True Figma canvas deep black
  card: '#16141F', // Deep dark purple-tinted card surface
  cardSecondary: '#1C1929', // Elevated card / row surface
  surface: '#16141F',
  surfaceSecondary: '#1C1929',
  surfaceElevated: '#1F1B30',
  surfaceOverlay: 'rgba(0, 0, 0, 0.75)',
  overlay: 'rgba(0, 0, 0, 0.75)',

  // Borders & Inputs
  border: '#252136', // Subtle purple-gray card border
  borderLight: '#36314D', // Slightly brighter border for active/focused elements
  inputBackground: '#161420', // Input field dark background
  placeholder: '#71717A', // Placeholder text
  disabled: '#27272A',
  disabledText: '#71717A',

  // Text tokens
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  text: '#FFFFFF',

  // Slate mapping for full backwards compatibility
  slate900: '#FFFFFF',
  slate800: '#E2E8F0',
  slate700: '#CBD5E1',
  slate600: '#94A3B8',
  slate500: '#64748B',
  slate400: '#71717A',
  slate300: '#3F3F46',
  slate200: '#27272A',
  slate100: '#18181B',
  slate50: '#121118',

  white: '#FFFFFF',
  black: '#000000',
  star: '#F59E0B'
};

export const lightColors = {
  // Brand Accents
  primary: '#7C3AED', // Consistent MENDROO purple accent
  primaryLight: '#8B5CF6',
  primaryDark: '#5B21B6',
  primarySubtle: '#EDE9FE', // Soft violet highlight background

  secondary: '#7C3AED',
  secondarySubtle: '#F5F3FF',

  // Status Colors (Accessible in Light Mode)
  success: '#10B981',
  successLight: '#34D399',
  successSubtle: '#D1FAE5',

  warning: '#D97706',
  warningLight: '#F59E0B',
  warningSubtle: '#FEF3C7',

  danger: '#EF4444',
  dangerSubtle: '#FEE2E2',
  error: '#EF4444',

  // Surfaces & Backgrounds (Light Design System)
  background: '#F7F8FC', // Crisp modern app background
  card: '#FFFFFF', // Clean white primary surface
  cardSecondary: '#F1F2F8', // Subtle secondary card / row surface
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F2F8',
  surfaceElevated: '#FFFFFF',
  surfaceOverlay: 'rgba(15, 23, 42, 0.45)',
  overlay: 'rgba(15, 23, 42, 0.45)',

  // Borders & Inputs
  border: '#E3E5EF', // Refined light border
  borderLight: '#D0D3E5',
  inputBackground: '#FFFFFF',
  placeholder: '#898CA0',
  disabled: '#E9EAF1',
  disabledText: '#898CA0',

  // Text tokens
  textPrimary: '#171725', // High-contrast dark charcoal header/body
  textSecondary: '#64677A', // Muted slate secondary text
  textMuted: '#898CA0', // Tertiary placeholder/caption
  text: '#171725',

  // Slate mapping for full backwards compatibility
  slate900: '#171725',
  slate800: '#232533',
  slate700: '#3D4052',
  slate600: '#64677A',
  slate500: '#7B7E93',
  slate400: '#898CA0',
  slate300: '#CBD0E2',
  slate200: '#E3E5EF',
  slate100: '#F1F2F8',
  slate50: '#F7F8FC',

  white: '#FFFFFF',
  black: '#000000',
  star: '#F59E0B'
};

export const getThemeColors = (isDark = true) => (isDark ? darkColors : lightColors);

// Default export defaults to darkColors for backwards compatibility
export const colors = darkColors;
export const COLORS = darkColors;
export default darkColors;
