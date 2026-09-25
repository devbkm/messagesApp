import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, maxContentWidth, spacing } from '../../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView (forms, long text). Lists should use their own FlatList instead. */
  scroll?: boolean;
  /** Keep inputs and the footer visible above the software keyboard. */
  avoidKeyboard?: boolean;
  /** Height of any header above the screen, so keyboard avoidance lines up (see useHeaderHeight). */
  keyboardOffset?: number;
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
  keyboardOffset = 0,
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
          // Android runs edge-to-edge (SDK 57), so the window is not resized for the
          // keyboard and padding is needed on both platforms.
          behavior="padding"
          keyboardVerticalOffset={keyboardOffset}
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
