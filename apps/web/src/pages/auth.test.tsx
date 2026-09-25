import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import * as api from '../api/messages'
import {
  deferred,
  fakeAuthApi,
  notSignedIn,
  renderApp,
  session,
  signedOutAuthApi,
  summary,
  TEST_USER,
} from '../test/renderApp'

vi.mock('../api/messages')
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
  mockedApi.listMessages.mockResolvedValue({ items: [summary({ subject: 'My message' })] })
})

const h1 = (name: string) => screen.findByRole('heading', { level: 1, name })

describe('Route protection', () => {
  it.each(['/', '/inbox', '/messages/new', '/messages/msg-1'])(
    'sends a signed-out visitor from %s to Log in',
    async (path) => {
      const { router } = renderApp(path, { authApi: signedOutAuthApi() })

      expect(await h1('Log in')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
      expect(mockedApi.listMessages).not.toHaveBeenCalled()
      expect(mockedApi.getMessage).not.toHaveBeenCalled()
    },
  )

  it('returns to the originally requested page after logging in', async () => {
    mockedApi.getMessage.mockResolvedValue({
      id: 'msg-1',
      subject: 'Deep link',
      text: 'Body',
      created_at: '2026-09-25T07:28:00Z',
      attachment: null,
    })
    const authApi = signedOutAuthApi()
    const { user, router } = renderApp('/messages/msg-1', { authApi })

    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await h1('Deep link')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/messages/msg-1')
  })

  it.each(['/login', '/signup'])('sends a signed-in user from %s to the inbox', async (path) => {
    const { router } = renderApp(path)

    expect(await h1('Inbox')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows the signed-in user and a Log out button in the header', async () => {
    renderApp('/')

    const banner = await screen.findByRole('banner')
    expect(await within(banner).findByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(banner).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('waits for the server before deciding, and offers retry if it is unreachable', async () => {
    const authApi = fakeAuthApi({
      getMe: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(0, 'network_error', 'offline'))
        .mockResolvedValueOnce(TEST_USER),
    })
    const { user } = renderApp('/', { authApi })

    expect(await screen.findByText("Couldn't connect")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await h1('Inbox')).toBeInTheDocument()
  })
})

describe('Log in', () => {
  async function submitLogin(email: string, password: string) {
    const { user, authApi } = renderApp('/login', { authApi: signedOutAuthApi() })
    await h1('Log in')
    if (email) await user.type(screen.getByRole('textbox', { name: 'Email' }), email)
    if (password) await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    return { user, authApi }
  }

  it('validates empty fields inline without calling the API', async () => {
    const { authApi } = await submitLogin('', '')

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Error: Enter your email address.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Error: Enter your password.')
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('rejects an invalid email address', async () => {
    const { authApi } = await submitLogin('not-an-email', 'whatever')

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Error: Enter a valid email address, like name@example.com.',
    )
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('signs in and shows the inbox', async () => {
    const { authApi } = await submitLogin(' ada@example.com ', 'correct horse')

    expect(await h1('Inbox')).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' })
  })

  it('shows a clear error for wrong credentials', async () => {
    const authApi = signedOutAuthApi()
    authApi.login.mockRejectedValue(new ApiError(401, 'invalid_credentials', 'Invalid email or password.'))
    const { user } = renderApp('/login', { authApi })
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('ada@example.com')
  })

  it('disables the button and ignores repeat submissions while logging in', async () => {
    const pending = deferred<ReturnType<typeof session>>()
    const authApi = signedOutAuthApi()
    authApi.login.mockReturnValue(pending.promise)
    const { user } = renderApp('/login', { authApi })
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const busy = await screen.findByRole('button', { name: 'Logging in…' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    await user.keyboard('{Enter}')
    expect(authApi.login).toHaveBeenCalledTimes(1)

    pending.resolve(session())
    expect(await h1('Inbox')).toBeInTheDocument()
  })

  it('explains an expired session', async () => {
    const authApi = fakeAuthApi({
      getMe: vi.fn().mockRejectedValue(new ApiError(401, 'session_expired', 'Expired')),
    })
    renderApp('/', { authApi })

    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeInTheDocument()
    expect(await h1('Log in')).toBeInTheDocument()
  })
})

describe('Sign up', () => {
  async function openSignup() {
    const authApi = signedOutAuthApi()
    const app = renderApp('/login', { authApi })
    await app.user.click(await screen.findByRole('link', { name: 'Create an account' }))
    await h1('Create account')
    return app
  }

  async function fill(user: Awaited<ReturnType<typeof openSignup>>['user'], values: Record<string, string>) {
    for (const [label, value] of Object.entries(values)) {
      if (value) await user.type(screen.getByLabelText(label), value)
    }
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('validates every field, including matching passwords', async () => {
    const { user, authApi } = await openSignup()

    await fill(user, { Name: ' ', Email: 'bad', Password: 'short', 'Confirm password': 'different' })

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Error: Enter your name.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Error: Enter a valid email address, like name@example.com.',
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Error: Use at least 8 characters.')
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Error: Passwords do not match.')
    expect(authApi.signup).not.toHaveBeenCalled()
  })

  it('creates the account and goes straight to the inbox', async () => {
    const { user, authApi } = await openSignup()

    await fill(user, {
      Name: 'Grace Hopper',
      Email: 'grace@example.com',
      Password: 'long enough',
      'Confirm password': 'long enough',
    })

    expect(await h1('Inbox')).toBeInTheDocument()
    expect(authApi.signup).toHaveBeenCalledWith({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'long enough',
      password_confirmation: 'long enough',
    })
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('shows "email already registered" on the email field', async () => {
    const { user, authApi } = await openSignup()
    authApi.signup.mockRejectedValue(new ApiError(409, 'email_taken', 'An account with this email already exists.'))

    await fill(user, {
      Name: 'Grace Hopper',
      Email: 'taken@example.com',
      Password: 'long enough',
      'Confirm password': 'long enough',
    })

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
        'Error: An account with this email already exists. Log in instead, or use another email.',
      ),
    )
    expect(screen.getByLabelText('Name')).toHaveValue('Grace Hopper')
  })

  it('links back to Log in', async () => {
    const { user } = await openSignup()

    await user.click(screen.getByRole('link', { name: 'Log in' }))

    expect(await h1('Log in')).toBeInTheDocument()
  })
})

describe('Log out', () => {
  it('ends the session and protects the inbox again', async () => {
    const authApi = fakeAuthApi()
    const { user, router } = renderApp('/', { authApi })
    await screen.findByRole('link', { name: /My message/ })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await h1('Log in')).toBeInTheDocument()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    // Trying to go back to the inbox now leads to Log in again.
    await router.navigate('/')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it("never shows the previous user's messages to the next user", async () => {
    const authApi = fakeAuthApi({
      login: vi.fn().mockResolvedValue(session({ ...TEST_USER, id: 'u2', name: 'Bob', email: 'bob@example.com' })),
    })
    mockedApi.listMessages
      .mockResolvedValueOnce({ items: [summary({ subject: "Ada's message" })] })
      .mockResolvedValueOnce({ items: [summary({ id: 'b1', subject: "Bob's message" })] })
    const { user } = renderApp('/', { authApi })
    await screen.findByRole('link', { name: /Ada's message/ })

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    authApi.getMe.mockRejectedValue(notSignedIn())
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'bob@example.com')
    await user.type(screen.getByLabelText('Password'), 'bob password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('link', { name: /Bob's message/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ada's message/ })).not.toBeInTheDocument()
  })
})
