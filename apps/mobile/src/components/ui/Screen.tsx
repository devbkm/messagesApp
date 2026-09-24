import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, maxContentWidth, spacing } from '../../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView (forms, long text). Lists should use their own FlatList instead. */
  scroll?: boolean;
  /** Keep inputs visible above the software keyboard. */
  avoidKeyboard?: boolean;
  /** Content pinned to the bottom (e.g. a primary action), kept above the home indicator. */
  footer?: ReactNode;
  /** The native stack header already handles the top inset. */
  edges?: Edge[];
};

/** Standard screen container: safe areas, consistent padding, readable max width. */
export function Screen({
  children,
  scroll = false,
  avoidKeyboard = false,
  footer,
  edges = ['left', 'right', 'bottom'],
}: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, styles.scrollContent]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer ? <View style={[styles.content, styles.footer]}>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  footer: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
