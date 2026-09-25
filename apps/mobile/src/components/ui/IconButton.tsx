import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, touchTarget } from '../../theme/tokens';

type IconButtonProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Required: icon-only controls must be named for screen readers. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  testID?: string;
};

/** Icon-only button with a full 48dp touch target. */
export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  tone = 'neutral',
  disabled = false,
  testID,
}: IconButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={disabled ? colors.disabledText : tone === 'danger' ? colors.danger : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
});
