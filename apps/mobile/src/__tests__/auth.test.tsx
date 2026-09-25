import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '../api/client';
import * as api from '../api/messages';
import { getToken } from '../auth/tokenStorage';
import { deferred, fakeAuthApi, renderApp, resetMocks, session, summary, TEST_USER } from '../test-utils/renderApp';

jest.mock('../api/messages');
const mockedApi = jest.mocked(api);

beforeEach(() => {
  resetMocks(mockedApi);
  mockedApi.listMessages.mockResolvedValue({ items: [summary({ subject: 'My message' })] });
});

const invalidCredentials = () => new ApiError(401, 'invalid_credentials', 'Invalid email or password.');

async function fillLogin(email: string, password: string) {
  await fireEvent.changeText(await screen.findByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByTestId('login-submit'));
}

async function openSignup() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an account' }));
  return screen.findByLabelText('Name');
}

async function fillSignup(values: { name?: string; email?: string; password?: string; confirm?: string }) {
  await fireEvent.changeText(screen.getByLabelText('Name'), values.name ?? 'Grace Hopper');
  await fireEvent.changeText(screen.getByLabelText('Email'), values.email ?? 'grace@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), values.password ?? 'long enough');
  await fireEvent.changeText(screen.getByLabelText('Confirm password'), values.confirm ?? values.password ?? 'long enough');
  await fireEvent.press(screen.getByTestId('signup-submit'));
}

describe('Start-up', () => {
  it('shows Log in when there is no stored session, without calling the API', async () => {
    const authApi = fakeAuthApi();

    await renderApp({ signedIn: false, authApi });

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(authApi.getMe).not.toHaveBeenCalled();
    expect(mockedApi.listMessages).not.toHaveBeenCalled();
  });

  it('restores a stored session only after the server confirms it', async () => {
    const me = deferred<typeof TEST_USER>();
    const authApi = fakeAuthApi({ getMe: jest.fn().mockReturnValue(me.promise) });

    await renderApp({ authApi });

    expect(screen.getByLabelText('Checking your sign-in…')).toBeOnTheScreen();
    expect(screen.queryByText('My message')).not.toBeOnTheScreen();
    me.resolve(TEST_USER);

    expect(await screen.findByText('My message')).toBeOnTheScreen();
    expect(screen.getByLabelText('Signed in as Ada Lovelace, ada@example.com')).toBeOnTheScreen();
  });

  it('sends an expired stored session back to Log in with an explanation', async () => {
    const authApi = fakeAuthApi({
      getMe: jest.fn().mockRejectedValue(new ApiError(401, 'session_expired', 'Expired')),
    });

    await renderApp({ authApi });

    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeOnTheScreen();
    expect(await getToken()).toBeNull();
    expect(mockedApi.listMessages).not.toHaveBeenCalled();
  });

  it('offers retry when the server cannot confirm the session', async () => {
    const authApi = fakeAuthApi({
      getMe: jest
        .fn()
        .mockRejectedValueOnce(new ApiError(0, 'network_error', 'offline'))
        .mockResolvedValueOnce(TEST_USER),
    });

    await renderApp({ authApi });

    expect(await screen.findByText("Couldn't connect")).toBeOnTheScreen();
    // The token is kept: being offline is not the same as being logged out.
    expect(await getToken()).toBe('session-token');
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('My message')).toBeOnTheScreen();
  });
});

describe('Log in', () => {
  it('validates empty and invalid fields without calling the API', async () => {
    const authApi = fakeAuthApi();
    await renderApp({ signedIn: false, authApi });

    await fireEvent.press(await screen.findByTestId('login-submit'));
    expect(screen.getByText('Error: Enter your email address.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Enter your password.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    expect(screen.getByText('Error: Enter a valid email address, like name@example.com.')).toBeOnTheScreen();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('signs in, stores the token and shows only that user\'s inbox', async () => {
    const authApi = fakeAuthApi({ login: jest.fn().mockResolvedValue(session(TEST_USER, 'new-token')) });
    await renderApp({ signedIn: false, authApi });

    await fillLogin('  ada@example.com ', 'correct horse');

    expect(await screen.findByText('My message')).toBeOnTheScreen();
    expect(authApi.login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' });
    expect(await getToken()).toBe('new-token');
  });

  it('shows a clear error for wrong credentials and keeps the email', async () => {
    const authApi = fakeAuthApi({ login: jest.fn().mockRejectedValue(invalidCredentials()) });
    await renderApp({ signedIn: false, authApi });

    await fillLogin('ada@example.com', 'wrong password');

    expect(await screen.findByText('Invalid email or password.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toHaveDisplayValue('ada@example.com');
    expect(screen.queryByText('My message')).not.toBeOnTheScreen();
  });

  it('shows progress and ignores repeated submissions', async () => {
    const pending = deferred<ReturnType<typeof session>>();
    const authApi = fakeAuthApi({ login: jest.fn().mockReturnValue(pending.promise) });
    await renderApp({ signedIn: false, authApi });

    await fillLogin('ada@example.com', 'correct horse');
    const busy = await screen.findByRole('button', { name: 'Logging in…', busy: true });
    expect(busy).toBeDisabled();
    await fireEvent.press(busy);

    expect(authApi.login).toHaveBeenCalledTimes(1);
    pending.resolve(session());
    expect(await screen.findByText('My message')).toBeOnTheScreen();
  });
});

describe('Sign up', () => {
  it('is reachable from Log in and back', async () => {
    await renderApp({ signedIn: false });

    expect(await openSignup()).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
  });

  it('validates every field, including matching passwords', async () => {
    const authApi = fakeAuthApi();
    await renderApp({ signedIn: false, authApi });
    await openSignup();

    await fillSignup({ name: ' ', email: 'bad', password: 'short', confirm: 'different' });

    expect(screen.getByText('Error: Enter your name.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Enter a valid email address, like name@example.com.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Use at least 8 characters.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Passwords do not match.')).toBeOnTheScreen();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it('signs the new user straight in, without a separate login', async () => {
    const newUser = { ...TEST_USER, id: 'user-2', name: 'Grace Hopper', email: 'grace@example.com' };
    const authApi = fakeAuthApi({ signup: jest.fn().mockResolvedValue(session(newUser, 'fresh-token')) });
    mockedApi.listMessages.mockResolvedValue({ items: [] });
    await renderApp({ signedIn: false, authApi });
    await openSignup();

    await fillSignup({ name: ' Grace Hopper ', email: 'grace@example.com', password: 'long enough' });

    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
    expect(screen.getByLabelText('Signed in as Grace Hopper, grace@example.com')).toBeOnTheScreen();
    expect(authApi.signup).toHaveBeenCalledWith({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'long enough',
      password_confirmation: 'long enough',
    });
    expect(authApi.login).not.toHaveBeenCalled();
    expect(await getToken()).toBe('fresh-token');
  });

  it('shows "email already registered" next to the email field and keeps the input', async () => {
    const authApi = fakeAuthApi({
      signup: jest.fn().mockRejectedValue(new ApiError(409, 'email_taken', 'An account with this email already exists.')),
    });
    await renderApp({ signedIn: false, authApi });
    await openSignup();

    await fillSignup({});

    expect(
      await screen.findByText('Error: An account with this email already exists. Log in instead, or use another email.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toHaveDisplayValue('Grace Hopper');
  });
});

describe('Log out', () => {
  it('ends the session on the server, forgets the token and returns to Log in', async () => {
    const authApi = fakeAuthApi();
    await renderApp({ authApi });
    await screen.findByText('My message');

    await fireEvent.press(screen.getByTestId('logout'));

    expect(await screen.findByText('Welcome back')).toBeOnTheScreen();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(await getToken()).toBeNull();
    expect(screen.queryByText('My message')).not.toBeOnTheScreen();
  });

  it('never shows the previous user\'s messages to the next user', async () => {
    const other = { ...TEST_USER, id: 'user-2', name: 'Bob', email: 'bob@example.com' };
    const authApi = fakeAuthApi({ login: jest.fn().mockResolvedValue(session(other, 'bob-token')) });
    mockedApi.listMessages
      .mockResolvedValueOnce({ items: [summary({ subject: "Ada's message" })] })
      .mockResolvedValueOnce({ items: [summary({ id: 'b1', subject: "Bob's message" })] });
    await renderApp({ authApi });
    await screen.findByText("Ada's message");

    await fireEvent.press(screen.getByTestId('logout'));
    await fillLogin('bob@example.com', 'bob password');

    expect(await screen.findByText("Bob's message")).toBeOnTheScreen();
    expect(screen.queryByText("Ada's message")).not.toBeOnTheScreen();
    await waitFor(() => expect(mockedApi.listMessages).toHaveBeenCalledTimes(2));
  });
});
