import { useAuth } from '../auth/AuthProvider';
import { ErrorState, LoadingState, Screen } from '../components/ui';
import { describeError } from '../utils/errors';

/** Shown while a stored session is confirmed with the server, or if that fails. */
export function StartupScreen() {
  const auth = useAuth();

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      {auth.status === 'error' ? (
        <ErrorState
          title="Couldn't connect"
          message={describeError(auth.error)}
          onRetry={auth.retry}
        />
      ) : (
        <LoadingState label="Checking your sign-in…" />
      )}
    </Screen>
  );
}
