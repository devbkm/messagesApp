import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '../../theme/tokens';
import { AppText } from './AppText';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Guidance shown below the field while there is no error. */
  hint?: string;
  error?: string;
  /**
   * Shows "count/limit". Unlike `maxLength` it does not truncate input, so pasted
   * text is never silently cut off; the form explains the problem instead.
   */
  counter?: { count: number; limit: number };
  required?: boolean;
};

/**
 * Labelled text input. The label is always visible (never placeholder-only), errors
 * are conveyed with text as well as colour, and a character counter can be shown.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, counter, required = false, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const describedText = error ? `Error: ${error}` : hint;
  const overLimit = counter ? counter.count > counter.limit : false;

  return (
    <View style={styles.container}>
      {/* Visual label; the input carries the same name as its accessibilityLabel. */}
      <AppText variant="label" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
        {required ? (
          <AppText variant="label" color="textMuted">
            {' '}
            (required)
          </AppText>
        ) : null}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={required ? `${label}, required` : label}
        accessibilityHint={describedText}
        aria-invalid={Boolean(error)}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={1.8}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, multiline && styles.multiline, focused && styles.focused, error ? styles.invalid : null]}
        {...rest}
      />
      <View style={styles.footer}>
        <View style={styles.message}>
          {error ? (
            <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
              <AppText variant="caption" color="danger" style={styles.errorPrefix}>
                Error:{' '}
              </AppText>
              {error}
            </AppText>
          ) : hint ? (
            <AppText variant="caption" color="textMuted">
              {hint}
            </AppText>
          ) : null}
        </View>
        {counter ? (
          <AppText
            variant="caption"
            color={overLimit ? 'danger' : 'textMuted'}
            accessibilityLabel={`${counter.count} of ${counter.limit} characters used`}
            style={styles.counter}
          >
            {counter.count}/{counter.limit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  input: {
    ...typography.body,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  multiline: {
    minHeight: 180,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  focused: {
    borderColor: colors.focus,
    borderWidth: 2,
    // Compensate for the thicker border so the text does not shift.
    paddingHorizontal: spacing.md - 1,
  },
  invalid: {
    borderColor: colors.danger,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 18,
  },
  message: {
    flex: 1,
  },
  errorPrefix: {
    fontWeight: '600',
  },
  counter: {
    fontVariant: ['tabular-nums'],
  },
});
