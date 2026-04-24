import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, SemanticColors } from '../config/theme';
import { useSettingsStore } from '../store/settingsStore';

interface ThemeContextValue {
  semantic: SemanticColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  semantic: dark,
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const appearance = useSettingsStore((s) => s.appearance);
  const systemScheme = useColorScheme();

  const isDark = useMemo(() => {
    if (appearance === 'dark') { return true; }
    if (appearance === 'light') { return false; }
    return systemScheme === 'dark';
  }, [appearance, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ semantic: isDark ? dark : light, isDark }),
    [isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
