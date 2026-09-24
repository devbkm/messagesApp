/**
 * Design tokens. Values are mirrored in apps/web/src/styles/tokens.css so both
 * clients share one visual language. Text colours meet WCAG AA (>= 4.5:1) on
 * `background` and `surface`.
 */

export const colors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfacePressed: '#EEF1F5',
  border: '#DDE1E7',
  borderStrong: '#B9C0CB',

  text: '#161A22',
  textMuted: '#555D6B',
  textOnPrimary: '#FFFFFF',

  primary: '#2F55D4',
  primaryPressed: '#2445B3',
  primarySubtle: '#E8EDFC',

  danger: '#B42318',
  dangerPressed: '#912018',
  dangerSubtle: '#FDECEA',

  disabledBackground: '#E6E9EE',
  disabledText: '#7A8290',

  focus: '#2F55D4',
  overlay: 'rgba(15, 18, 25, 0.5)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/** Minimum touch target recommended by Apple HIG (44pt) and Material (48dp). */
export const touchTarget = 48;

/** Comfortable reading width for tablets and large phones. */
export const maxContentWidth = 640;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;
export type ColorName = keyof typeof colors;
