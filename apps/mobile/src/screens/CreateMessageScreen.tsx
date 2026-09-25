import { useHeaderHeight } from '@react-navigation/elements';
import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type TextInput } from 'react-native';

import { ApiError } from '../api/client';
import { Button, ConfirmDialog, InlineError, Screen, TextField } from '../components/ui';
import { useCreateMessage } from '../hooks/useMessages';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme/tokens';
import { describeError } from '../utils/errors';
import { SUBJECT_MAX_LENGTH, effectiveLength, validateMessage, type MessageFormValues } from '../utils/validation';

type Field = keyof MessageFormValues;

export function CreateMessageScreen({ navigation }: RootStackScreenProps<'CreateMessage'>) {
  const headerHeight = useHeaderHeight();
  const creation = useCreateMessage();
  const subjectRef = useRef<TextInput>(null);
  const textRef = useRef<TextInput>(null);

  const [values, setValues] = useState<MessageFormValues>({ subject: '', text: '' });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ subject: false, text: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [created, setCreated] = useState(false);

  const errors = validateMessage(values);
  const serverErrors = creation.error instanceof ApiError ? creation.error.fieldErrors : {};
  const subjectLength = effectiveLength(values.subject);

  // Show "required" errors once a field was left or a submit was attempted, but
  // report an over-long subject immediately while typing.
  const visibleError = (field: Field): string | undefined => {
    const error = errors[field];
    if (!error) return serverErrors[field];
    if (submitAttempted || touched[field]) return error;
    if (field === 'subject' && subjectLength > SUBJECT_MAX_LENGTH) return error;
    return undefined;
  };

  // Ask before throwing away a draft (back gesture, header back, hardware back).
  const hasDraft = values.subject.trim() !== '' || values.text.trim() !== '';
  const [discardAction, setDiscardAction] = useState<(() => void) | null>(null);
  usePreventRemove(hasDraft && !created, ({ data }) => {
    setDiscardAction(() => () => navigation.dispatch(data.action));
  });

  // Leave once the "created" state has rendered, so the draft guard is already off.
  useEffect(() => {
    if (created) navigation.goBack();
  }, [created, navigation]);

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (creation.isError) creation.reset();
  };

  const submit = () => {
    if (creation.isPending) return; // prevent duplicate submissions
    setSubmitAttempted(true);

    if (errors.subject || errors.text) {
      (errors.subject ? subjectRef : textRef).current?.focus();
      AccessibilityInfo.announceForAccessibility('Please fix the highlighted fields.');
      return;
    }

    creation.mutate(
      { subject: values.subject.trim(), text: values.text.trim() },
      {
        onSuccess: () => {
          setCreated(true);
          AccessibilityInfo.announceForAccessibility('Message created');
        },
      },
    );
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      keyboardOffset={headerHeight}
      footer={
        <View style={styles.footer}>
          {creation.isError ? (
            <InlineError message={`Your message wasn't saved. ${describeError(creation.error)}`} />
          ) : null}
          <Button
            label={creation.isPending ? 'Creating…' : 'Create message'}
            fullWidth
            loading={creation.isPending}
            onPress={submit}
            testID="submit-message"
          />
        </View>
      }
    >
      <TextField
        ref={subjectRef}
        label="Subject"
        required
        placeholder="What is it about?"
        value={values.subject}
        onChangeText={update('subject')}
        onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
        error={visibleError('subject')}
        hint={`Up to ${SUBJECT_MAX_LENGTH} characters.`}
        counter={{ count: subjectLength, limit: SUBJECT_MAX_LENGTH }}
        autoCapitalize="sentences"
        autoCorrect
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => textRef.current?.focus()}
        editable={!creation.isPending}
        testID="subject-input"
      />
      <TextField
        ref={textRef}
        label="Message"
        required
        placeholder="Write your message…"
        value={values.text}
        onChangeText={update('text')}
        onBlur={() => setTouched((t) => ({ ...t, text: true }))}
        error={visibleError('text')}
        multiline
        autoCapitalize="sentences"
        autoCorrect
        textAlignVertical="top"
        editable={!creation.isPending}
        testID="text-input"
      />

      <ConfirmDialog
        visible={discardAction !== null}
        title="Discard this message?"
        message="What you have written will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          const leave = discardAction;
          setDiscardAction(null);
          leave?.();
        }}
        onCancel={() => setDiscardAction(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: spacing.md,
  },
});
