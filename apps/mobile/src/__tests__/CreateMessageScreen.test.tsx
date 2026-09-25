import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '../api/client';
import * as api from '../api/messages';
import type { Message } from '../api/types';
import { navigationRef } from '../navigation/RootNavigator';
import { deferred, fullMessage, renderApp, summary, resetMocks } from '../test-utils/renderApp';

jest.mock('../api/messages');
const mockedApi = jest.mocked(api);

beforeEach(() => {
  resetMocks(mockedApi);
});

async function openCreateScreen() {
  mockedApi.listMessages.mockResolvedValue({ items: [summary({ id: 'old', subject: 'Older message' })] });
  await renderApp();
  await fireEvent.press(await screen.findByRole('button', { name: 'New message' }));
  return {
    subject: await screen.findByLabelText('Subject, required'),
    text: screen.getByLabelText('Message, required'),
    submit: screen.getByTestId('submit-message'),
  };
}

describe('Create message form', () => {
  it('shows labels, placeholders and a character counter', async () => {
    const { subject } = await openCreateScreen();

    expect(screen.getByPlaceholderText('What is it about?')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Write your message…')).toBeOnTheScreen();
    expect(screen.getByText('0/40')).toBeOnTheScreen();

    await fireEvent.changeText(subject, 'Hello');

    expect(screen.getByText('5/40')).toBeOnTheScreen();
    expect(screen.getByLabelText('5 of 40 characters used')).toBeOnTheScreen();
  });

  it('flags required fields on submit without calling the API', async () => {
    const { submit } = await openCreateScreen();

    await fireEvent.press(submit);

    // Errors are spelled out in text ("Error: …"), not signalled by colour alone.
    expect(screen.getByText('Error: Enter a subject.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Enter a message.')).toBeOnTheScreen();
    expect(mockedApi.createMessage).not.toHaveBeenCalled();
  });

  it('treats whitespace-only input as empty', async () => {
    const { subject, text, submit } = await openCreateScreen();

    await fireEvent.changeText(subject, '    ');
    await fireEvent.changeText(text, '  \n ');
    await fireEvent.press(submit);

    expect(screen.getByText('Error: Enter a subject.')).toBeOnTheScreen();
    expect(screen.getByText('Error: Enter a message.')).toBeOnTheScreen();
    expect(mockedApi.createMessage).not.toHaveBeenCalled();
  });

  it('reports an over-long subject immediately while typing', async () => {
    const { subject } = await openCreateScreen();

    await fireEvent.changeText(subject, 'x'.repeat(42));

    expect(screen.getByText('Error: Subject is 2 characters too long (max 40).')).toBeOnTheScreen();
    expect(screen.getByText('42/40')).toBeOnTheScreen();
  });

  it('shows a required error once a field is left empty', async () => {
    const { subject } = await openCreateScreen();

    expect(screen.queryByText('Error: Enter a subject.')).not.toBeOnTheScreen();
    await fireEvent(subject, 'blur');

    expect(screen.getByText('Error: Enter a subject.')).toBeOnTheScreen();
  });
});

describe('Submitting', () => {
  it('shows progress, prevents duplicates, then returns to the inbox showing the new message', async () => {
    const request = deferred<Message>();
    mockedApi.createMessage.mockReturnValue(request.promise);
    const { subject, text, submit } = await openCreateScreen();

    await fireEvent.changeText(subject, '  Weekly update  ');
    await fireEvent.changeText(text, 'All good this week.');
    await fireEvent.press(submit);

    const busy = await screen.findByRole('button', { name: 'Creating…', busy: true });
    expect(busy).toBeDisabled();
    await fireEvent.press(busy);
    expect(mockedApi.createMessage).toHaveBeenCalledTimes(1);
    expect(mockedApi.createMessage).toHaveBeenCalledWith({ subject: 'Weekly update', text: 'All good this week.' });

    mockedApi.listMessages.mockResolvedValue({
      items: [summary({ id: 'new', subject: 'Weekly update' }), summary({ id: 'old', subject: 'Older message' })],
    });
    request.resolve(fullMessage({ id: 'new', subject: 'Weekly update', text: 'All good this week.' }));

    // Back on the inbox, with the new message listed.
    expect(await screen.findByText('Weekly update')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByLabelText('Subject, required')).not.toBeOnTheScreen());
    expect(screen.getByText('Older message')).toBeOnTheScreen();
  });

  it('stays on the form, keeps the input and allows retry when saving fails', async () => {
    mockedApi.createMessage
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'Could not reach the server.'))
      .mockResolvedValueOnce(fullMessage({ id: 'new', subject: 'Retry me' }));
    const { subject, text, submit } = await openCreateScreen();

    await fireEvent.changeText(subject, 'Retry me');
    await fireEvent.changeText(text, 'Important content');
    await fireEvent.press(submit);

    expect(
      await screen.findByText(
        "Your message wasn't saved. Can't reach the server. Check your connection and try again.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Subject, required')).toHaveDisplayValue('Retry me');
    expect(screen.getByLabelText('Message, required')).toHaveDisplayValue('Important content');

    mockedApi.listMessages.mockResolvedValue({ items: [summary({ id: 'new', subject: 'Retry me' })] });
    await fireEvent.press(screen.getByTestId('submit-message'));

    await waitFor(() => expect(screen.queryByLabelText('Subject, required')).not.toBeOnTheScreen());
    expect(await screen.findByText('Retry me')).toBeOnTheScreen();
    expect(mockedApi.createMessage).toHaveBeenCalledTimes(2);
  });

  it('shows server-side field errors next to the field', async () => {
    mockedApi.createMessage.mockRejectedValue(
      new ApiError(422, 'validation_error', 'The request is invalid.', {
        subject: 'String should have at most 40 characters',
      }),
    );
    const { subject, text, submit } = await openCreateScreen();

    await fireEvent.changeText(subject, 'Valid locally');
    await fireEvent.changeText(text, 'Body');
    await fireEvent.press(submit);

    expect(await screen.findByText('Error: String should have at most 40 characters')).toBeOnTheScreen();
    expect(screen.getByLabelText('Subject, required')).toHaveDisplayValue('Valid locally');
  });
});

describe('Leaving with a draft', () => {
  async function pressBack() {
    await act(() => navigationRef.goBack());
  }

  it('leaves immediately when nothing was typed', async () => {
    await openCreateScreen();

    await pressBack();

    expect(await screen.findByRole('button', { name: 'New message' })).toBeOnTheScreen();
  });

  it('asks before discarding a draft, and keeps it when the user continues editing', async () => {
    const { subject } = await openCreateScreen();
    await fireEvent.changeText(subject, 'Half-written');

    await pressBack();

    expect(await screen.findByText('Discard this message?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Subject, required')).toHaveDisplayValue('Half-written');

    await pressBack();
    await fireEvent.press(await screen.findByRole('button', { name: 'Discard' }));

    expect(await screen.findByRole('button', { name: 'New message' })).toBeOnTheScreen();
    expect(mockedApi.createMessage).not.toHaveBeenCalled();
  });
});
