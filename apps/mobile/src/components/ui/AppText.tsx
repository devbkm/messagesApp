import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography, type ColorName, type TypographyVariant } from '../../theme/tokens';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
};

/** Text with a typography variant. Headings are exposed to screen readers as headers. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: AppTextProps) {
  const isHeading = variant === 'title' || variant === 'heading';
  return (
    <Text
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={1.8}
      style={[styles.base, typography[variant], { color: colors[color] }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // Keep text readable when the user enlarges the system font size.
    flexShrink: 1,
  },
});
