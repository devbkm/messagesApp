import { useHeaderHeight } from '@react-navigation/elements';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type TextInput } from 'react-native';

import type { LoginInput } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { AppText, Button, InlineError, NoticeBanner, Screen, TextField } from '../components/ui';
import type { RootStackScreenProps } from '../navigation/types';
import { spacing } from '../theme/tokens';
import { validateLogin, type LoginValues } from '../utils/authValidation';
import { describeError } from '../utils/errors';

type Field = keyof LoginValues;

export function LoginScreen({ navigation }: RootStackScreenProps<'Login'>) {
  const auth = useAuth();
  const headerHeight = useHeaderHeight();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const login = useMutation({ mutationFn: (input: LoginInput) => auth.signIn(input) });

  const errors = validateLogin(values);
  const visibleError = (field: Field) => (submitAttempted || touched[field] ? errors[field] : undefined);
  const notice = auth.status === 'signedOut' ? auth.notice : undefined;

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (login.isError) login.reset();
  };

  const submit = () => {
    if (login.isPending) return; // prevent duplicate submissions
    setSubmitAttempted(true);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      AccessibilityInfo.announceForAccessibility('Please fix the highlighted fields.');
      return;
    }
    auth.dismissNotice();
    login.mutate({ email: values.email.trim(), password: values.password });
  };

  return (
    <Screen
      scroll
      avoidKeyboard
      keyboardOffset={headerHeight}
      footer={
        <View style={styles.footer}>
          {login.isError ? <InlineError message={describeError(login.error)} /> : null}
          <Button
            label={login.isPending ? 'Logging in…' : 'Log in'}
            fullWidth
            loading={login.isPending}
            onPress={submit}
            testID="login-submit"
          />
          <Button
            label="Create an account"
            variant="ghost"
            fullWidth
            accessibilityHint="Opens the sign-up form"
            onPress={() => navigation.navigate('Signup')}
            disabled={login.isPending}
          />
        </View>
      }
    >
      <View style={styles.intro}>
        <AppText variant="title">Welcome back</AppText>
        <AppText color="textMuted">Log in to see your messages.</AppText>
      </View>
      {notice ? <NoticeBanner message={notice} /> : null}
      <TextField
        ref={emailRef}
        label="Email"
        placeholder="name@example.com"
        value={values.email}
        onChangeText={update('email')}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        error={visibleError('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!login.isPending}
        testID="login-email"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        placeholder="Your password"
        value={values.password}
        onChangeText={update('password')}
        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        error={visibleError('password')}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!login.isPending}
        testID="login-password"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
});
