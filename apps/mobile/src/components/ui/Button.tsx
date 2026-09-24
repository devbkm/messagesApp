import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '../../theme/tokens';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<Variant, { bg: string; pressed: string; text: string; border: string }> = {
  primary: {
    bg: colors.primary,
    pressed: colors.primaryPressed,
    text: colors.textOnPrimary,
    border: colors.primary,
  },
  secondary: {
    bg: colors.surface,
    pressed: colors.surfacePressed,
    text: colors.text,
    border: colors.borderStrong,
  },
  danger: {
    bg: colors.danger,
    pressed: colors.dangerPressed,
    text: colors.textOnPrimary,
    border: colors.danger,
  },
  ghost: {
    bg: 'transparent',
    pressed: colors.surfacePressed,
    text: colors.primary,
    border: 'transparent',
  },
};

/**
 * Button hierarchy: one `primary` action per screen, `secondary` for alternatives,
 * `danger` for destructive confirmation, `ghost` for low-emphasis actions.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  fullWidth = false,
  style,
  accessibilityHint,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const tone = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: isDisabled
            ? colors.disabledBackground
            : pressed
              ? tone.pressed
              : tone.bg,
          borderColor: isDisabled ? colors.disabledBackground : tone.border,
        },
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.textOnPrimary}
            importantForAccessibility="no"
          />
        ) : null}
        <AppText
          style={[styles.label, { color: isDisabled ? colors.disabledText : tone.text }]}
          numberOfLines={1}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 16,
  },
});
