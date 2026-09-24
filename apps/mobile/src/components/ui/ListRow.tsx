import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, touchTarget } from '../../theme/tokens';
import { AppText } from './AppText';

type ListRowProps = {
  title: string;
  /** Secondary line, e.g. a date. */
  meta?: string;
  onPress?: () => void;
  accessibilityHint?: string;
  /** Optional trailing control, e.g. a delete button. Rendered outside the pressable area. */
  trailing?: ReactNode;
};

/** Card-style list row. The main area is one pressable target; trailing actions are separate. */
export function ListRow({ title, meta, onPress, accessibilityHint, trailing }: ListRowProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={meta ? `${title}, ${meta}` : title}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="subheading" numberOfLines={2}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textMuted">
            {meta}
          </AppText>
        ) : null}
      </Pressable>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    minHeight: touchTarget + spacing.lg,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  trailing: {
    paddingRight: spacing.sm,
  },
});
