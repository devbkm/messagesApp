import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors, radius, spacing, touchTarget } from '../../theme/tokens';

function Bar({ width, height }: { width: DimensionValue; height: number }) {
  return <View style={[styles.bar, { width, height }]} />;
}

/**
 * Static placeholder rows shaped like the inbox list. Announced once as a single
 * "loading" element; no shimmer animation to keep motion to a minimum.
 */
export function ListSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <View
      style={styles.list}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      testID="list-skeleton"
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row} importantForAccessibility="no-hide-descendants">
          <Bar width={index % 2 === 0 ? '70%' : '55%'} height={16} />
          <Bar width="35%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  row: {
    minHeight: touchTarget + spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bar: {
    borderRadius: radius.sm,
    backgroundColor: colors.disabledBackground,
  },
});
