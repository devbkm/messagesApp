import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, touchTarget } from '../../theme/tokens';
import { AppText } from './AppText';

type ListRowProps = {
  title: string;
  /** Secondary line, e.g. a date. */
  meta?: string;
  onPress?: () => void;
  /** Overrides the spoken label (defaults to "title, meta"). */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Optional trailing control, e.g. a delete button. Rendered outside the pressable area. */
  trailing?: ReactNode;
  testID?: string;
};

/** Card-style list row. The main area is one pressable target; trailing actions are separate. */
export function ListRow({ title, meta, onPress, accessibilityLabel, accessibilityHint, trailing, testID }: ListRowProps) {
  return (
    <View style={styles.card}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (meta ? `${title}, ${meta}` : title)}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <AppText variant="subheading" numberOfLines={2}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
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
    minWidth: 0,
    minHeight: touchTarget + spacing.lg,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  trailing: {
    paddingRight: spacing.xs,
  },
});
