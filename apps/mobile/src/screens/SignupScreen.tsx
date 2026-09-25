import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, StyleSheet, View, type TextInput } from 'react-native';

import { ApiError } from '../api/client';
import type { SignupInput } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { AppText, Button, InlineError, Screen, TextField } from '../components/ui';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme/tokens';
import { PASSWORD_MIN_LENGTH, validateSignup, type SignupValues } from '../utils/authValidation';
import { describeError } from '../utils/errors';

type Field = keyof SignupValues;
const FIELDS: Field[] = ['name', 'email', 'password', 'confirmPassword'];

export function SignupScreen({ navigation }: RootStackScreenProps<'Signup'>) {
  const auth = useAuth();
  const headerHeight = useHeaderHeight();
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [values, setValues] = useState<SignupValues>({ name: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const signup = useMutation({ mutationFn: (input: SignupInput) => auth.signUp(input) });

  const errors = validateSignup(values);
  const serverErrors = signupServerErrors(signup.error);
  const visibleError = (field: Field) =>
    (submitAttempted || touched[field] ? errors[field] : undefined) ?? serverErrors[field];

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (signup.isError) signup.reset();
  };

  const submit = () => {
    if (signup.isPending) return; // prevent duplicate submissions
    setSubmitAttempted(true);
    const firstInvalid = FIELDS.find((field) => errors[field]);
    if (firstInvalid) {
      const refs: Record<Field, RefObject<TextInput | null>> = {
        name: nameRef,
        email: emailRef,
        password: passwordRef,
        confirmPassword: confirmRef,
      };
      refs[firstInvalid].current?.focus();
      AccessibilityInfo.announceForAccessibility('Please fix the highlighted fields.');
      return;
    }
    signup.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      password_confirmation: values.confirmPassword,
    });
  };

  // Field problems are shown next to the field; anything else goes in the banner.
  const bannerError = signup.isError && Object.keys(serverErrors).length === 0 ? describeError(signup.error) : null;

  // Shared props per field; refs are passed separately in the JSX.
  const field = (name: Field) => ({
    value: values[name],
    onChangeText: update(name),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    error: visibleError(name),
    editable: !signup.isPending,
    testID: `signup-${name}`,
  });

  return (
    <Screen
      scroll
      avoidKeyboard
      keyboardOffset={headerHeight}
      footer={
        <View style={styles.footer}>
          {bannerError ? <InlineError message={bannerError} /> : null}
          <Button
            label={signup.isPending ? 'Creating account…' : 'Create account'}
            fullWidth
            loading={signup.isPending}
            onPress={submit}
            testID="signup-submit"
          />
          <Button
            label="I already have an account"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('Login')}
            disabled={signup.isPending}
          />
        </View>
      }
    >
      <View style={styles.intro}>
        <AppText variant="title">Create your account</AppText>
        <AppText color="textMuted">Your messages are private to your account.</AppText>
      </View>
      <TextField
        ref={nameRef}
        {...field('name')}
        label="Name"
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        {...field('email')}
        label="Email"
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        {...field('password')}
        label="Password"
        placeholder="Choose a password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        {...field('confirmPassword')}
        label="Confirm password"
        placeholder="Enter it again"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </Screen>
  );
}

/** Server-side problems keyed by form field (API names mapped to the form's). */
function signupServerErrors(error: unknown): Partial<Record<Field, string>> {
  if (!(error instanceof ApiError)) return {};
  if (error.code === 'email_taken') return { email: describeError(error) };
  const { name, email, password, password_confirmation: confirmPassword } = error.fieldErrors;
  const mapped: Partial<Record<Field, string>> = { name, email, password, confirmPassword };
  return Object.fromEntries(Object.entries(mapped).filter(([, message]) => message));
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
});
