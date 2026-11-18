import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, getThemeColors } from '../theme/colors';
import { getTheme } from '../theme';

const THEME_STORAGE_KEY = '@mendroo_theme_mode';

export const ThemeContext = createContext({
  themeMode: 'dark', // 'dark' | 'light' | 'system'
  isDark: true,
  colors: darkColors,
  theme: getTheme(true),
  setThemeMode: () => {},
  statusBarStyle: 'light',
  navigationTheme: null
});

export const ThemeProvider = ({ children }) => {
  const deviceScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState('dark'); // Default to dark for existing user continuity
  const [isReady, setIsReady] = useState(false);

  // Restore persisted theme on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && saved && ['dark', 'light', 'system'].includes(saved)) {
          setThemeModeState(saved);
        }
      } catch (e) {
        // Fallback to default dark
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Listen to OS appearance changes when in system mode
  const [systemScheme, setSystemScheme] = useState(deviceScheme || Appearance.getColorScheme() || 'dark');
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    if (!['dark', 'light', 'system'].includes(mode)) return;
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to persist theme mode:', e);
    }
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => getThemeColors(isDark), [isDark]);
  const theme = useMemo(() => getTheme(isDark), [isDark]);
  const statusBarStyle = isDark ? 'light' : 'dark';

  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger
    }
  }), [isDark, colors]);

  const value = useMemo(() => ({
    themeMode,
    isDark,
    colors,
    theme,
    setThemeMode,
    statusBarStyle,
    navigationTheme,
    isReady
  }), [themeMode, isDark, colors, theme, setThemeMode, statusBarStyle, navigationTheme, isReady]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;
