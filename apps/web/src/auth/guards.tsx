import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom'

import { ErrorState, LoadingState } from '../components/ui'
import { describeError } from '../utils/errors'
import { useAuth } from './AuthProvider'

type FromState = { from?: Location } | null

/**
 * Protected routes. The server decides (via the auth state), not the URL: signed-out
 * visitors are sent to /login, remembering where they were going.
 */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'signedIn') return <Outlet />
  if (auth.status === 'signedOut') return <Navigate to="/login" replace state={{ from: location }} />
  return <SessionCheck />
}

/** /login and /signup: a signed-in user has no reason to be here, so go to the inbox. */
export function PublicOnly() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'signedIn') {
    const from = (location.state as FromState)?.from
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />
  }
  if (auth.status === 'signedOut') return <Outlet />
  return <SessionCheck />
}

function SessionCheck() {
  const auth = useAuth()
  return auth.status === 'error' ? (
    <ErrorState title="Couldn't connect" message={describeError(auth.error)} onRetry={auth.retry} />
  ) : (
    <LoadingState label="Checking your sign-in…" />
  )
}
