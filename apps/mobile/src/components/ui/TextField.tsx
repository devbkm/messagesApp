import { forwardRef, useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '../../theme/tokens';
import { AppText } from './AppText';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Guidance shown below the field while there is no error. */
  hint?: string;
  error?: string;
  /** Shows a "used / max" counter when `maxLength` is set. */
  showCount?: boolean;
  required?: boolean;
};

/**
 * Labelled text input. The label is always visible (never placeholder-only), errors
 * are conveyed with text as well as colour, and a character counter can be shown.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, showCount = false, required = false, maxLength, value, multiline, onFocus, onBlur, ...rest },
  ref,
) {
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const length = value?.length ?? 0;
  const describedText = error ? `Error: ${error}` : hint;

  return (
    <View style={styles.container}>
      <AppText nativeID={labelId} variant="label">
        {label}
        {required ? <AppText variant="label" color="textMuted">{' '}(required)</AppText> : null}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={required ? `${label}, required` : label}
        accessibilityLabelledBy={labelId}
        accessibilityHint={describedText}
        aria-invalid={Boolean(error)}
        value={value}
        maxLength={maxLength}
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
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.invalid : null,
        ]}
        {...rest}
      />
      <View style={styles.footer}>
        <AppText variant="caption" color={error ? 'danger' : 'textMuted'} style={styles.message}>
          {describedText ?? ''}
        </AppText>
        {showCount && maxLength ? (
          <AppText
            variant="caption"
            color={length >= maxLength ? 'danger' : 'textMuted'}
            accessibilityLabel={`${length} of ${maxLength} characters used`}
          >
            {length}/{maxLength}
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
    minHeight: 160,
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
});
