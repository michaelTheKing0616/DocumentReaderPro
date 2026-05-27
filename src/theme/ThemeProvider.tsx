import React, { createContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { lightColors, darkColors, type ColorPalette } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { radius } from './radius';
import { lightShadows, darkShadows, type ShadowTokens } from './shadows';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'auto' | 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: ColorPalette;
  spacing: typeof spacing;
  typography: typeof typography;
  radius: typeof radius;
  shadows: ShadowTokens;
}

export interface ThemeContextValue {
  theme: Theme;
  colorScheme: ThemeMode;
  preference: ThemePreference;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

function resolveThemeMode(
  preference: ThemePreference,
  systemScheme: ReturnType<typeof useColorScheme>
): ThemeMode {
  if (preference === 'auto') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const preference = useSelector(
    (state: RootState) => state.ux.preferences.theme
  );

  const colorScheme = useMemo(
    () => resolveThemeMode(preference, systemScheme),
    [preference, systemScheme]
  );

  const theme = useMemo<Theme>(
    () => ({
      mode: colorScheme,
      colors: colorScheme === 'dark' ? darkColors : lightColors,
      spacing,
      typography,
      radius,
      shadows: colorScheme === 'dark' ? darkShadows : lightShadows,
    }),
    [colorScheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, colorScheme, preference }),
    [theme, colorScheme, preference]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
