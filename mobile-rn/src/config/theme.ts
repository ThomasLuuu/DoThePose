export const colors = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  accent: '#06B6D4',

  background: '#F8FAFC',
  backgroundDark: '#0F172A',
  surface: '#FFFFFF',
  surfaceDark: '#1E293B',

  text: '#1E293B',
  textLight: '#64748B',
  textDark: '#F8FAFC',

  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',

  border: '#E2E8F0',
  borderDark: '#334155',
};

export type SemanticColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Brand highlight — used as button/badge backgrounds and icon tints. */
  accent: string;
  /** Text/icon color to place ON top of accent-coloured backgrounds. */
  accentText: string;
  primary: string;
  error: string;
  success: string;
};

/** Semantic tokens – dark palette */
export const dark: SemanticColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceMuted: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: '#38383A',
  accent: '#FFD60A',
  accentText: '#000000',
  primary: colors.primary,
  error: colors.error,
  success: colors.success,
};

/** Semantic tokens – light palette */
export const light: SemanticColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#E5E5EA',
  text: '#000000',
  textSecondary: '#6C6C70',
  border: '#C6C6C8',
  /** In light mode use primary indigo — readable on light backgrounds. */
  accent: colors.primary,
  accentText: '#ffffff',
  primary: colors.primary,
  error: colors.error,
  success: colors.success,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
