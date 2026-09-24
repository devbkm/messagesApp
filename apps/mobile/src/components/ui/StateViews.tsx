import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

/** Centred loading indicator with a visible, announced label. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View
      style={styles.centered}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText color="textMuted">{label}</AppText>
    </View>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Error with a plain-language explanation and an optional retry action. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <View style={styles.centered}>
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.text}>
        <AppText variant="heading" style={styles.center}>
          {title}
        </AppText>
        <AppText color="textMuted" style={styles.center}>
          {message}
        </AppText>
      </View>
      {onRetry ? (
        <Button label="Try again" variant="secondary" onPress={onRetry} loading={retrying} />
      ) : null}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message?: string;
  action?: ReactNode;
};

/** Explains why a view is empty and, where possible, what to do next. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.centered}>
      <View accessible style={styles.text}>
        <AppText variant="heading" style={styles.center}>
          {title}
        </AppText>
        {message ? (
          <AppText color="textMuted" style={styles.center}>
            {message}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/** Inline error banner, e.g. for a failed form submission. */
export function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.banner} accessible accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <AppText variant="label" color="danger">
        Error
      </AppText>
      <AppText color="danger">{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  text: {
    gap: spacing.sm,
    alignItems: 'center',
    maxWidth: 360,
  },
  center: {
    textAlign: 'center',
  },
  banner: {
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSubtle,
  },
});
