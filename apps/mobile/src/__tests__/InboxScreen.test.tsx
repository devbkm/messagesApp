import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ApiError } from '../api/client';
import * as api from '../api/messages';
import { deferred, renderApp, summary, resetMocks } from '../test-utils/renderApp';

jest.mock('../api/messages');
const mockedApi = jest.mocked(api);

beforeEach(() => {
  resetMocks(mockedApi);
});

describe('Inbox rendering', () => {
  it('shows each message with its subject and creation date', async () => {
    mockedApi.listMessages.mockResolvedValue({
      items: [
        summary({ id: 'a', subject: 'Quarterly report', created_at: '2026-09-25T07:28:00Z' }),
        summary({ id: 'b', subject: 'Team lunch', created_at: '2026-01-03T18:05:00Z', has_attachment: true }),
      ],
    });

    await renderApp();

    expect(await screen.findByText('Quarterly report')).toBeOnTheScreen();
    expect(screen.getByText('25.09.2026, 07:28')).toBeOnTheScreen();
    expect(screen.getByText('Team lunch')).toBeOnTheScreen();
    // The paperclip icon sits between the date and the word "Attachment".
    expect(screen.getByText(/^03\.01\.2026, 18:05 · .*Attachment$/)).toBeOnTheScreen();
    expect(screen.getByText('2 messages · newest first')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'New message' })).toBeOnTheScreen();
  });

  it('gives rows and delete buttons meaningful accessible names', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [summary({ subject: 'Quarterly report' })] });

    await renderApp();

    expect(await screen.findByRole('button', { name: 'Quarterly report, 25 September 2026 at 07:28' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete message: Quarterly report' })).toBeOnTheScreen();
  });

  it('renders a long subject without dropping it', async () => {
    const longSubject = 'A subject that is exactly forty chars!!';
    mockedApi.listMessages.mockResolvedValue({ items: [summary({ subject: longSubject })] });

    await renderApp();

    expect(await screen.findByText(longSubject)).toBeOnTheScreen();
  });
});

describe('Inbox states', () => {
  it('shows a loading skeleton, not the empty state, while loading', async () => {
    const request = deferred<{ items: never[] }>();
    mockedApi.listMessages.mockReturnValue(request.promise);

    await renderApp();

    expect(screen.getByTestId('list-skeleton')).toBeOnTheScreen();
    expect(screen.queryByText('Your inbox is empty')).not.toBeOnTheScreen();

    request.resolve({ items: [] });
    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('list-skeleton')).not.toBeOnTheScreen();
  });

  it('shows a friendly empty state with a way to create the first message', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [] });

    await renderApp();

    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Write your first message' }));
    expect(await screen.findByLabelText('Subject, required')).toBeOnTheScreen();
  });

  it('shows an error with retry and recovers', async () => {
    mockedApi.listMessages
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'Could not reach the server.'))
      .mockResolvedValueOnce({ items: [summary({ subject: 'Back online' })] });

    await renderApp();

    expect(await screen.findByText("Couldn't load your messages")).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the server. Check your connection and try again.")).toBeOnTheScreen();
    expect(screen.queryByText(/Error|stack|at Object/)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Back online')).toBeOnTheScreen();
    expect(mockedApi.listMessages).toHaveBeenCalledTimes(2);
  });

  it('never shows internal error details', async () => {
    mockedApi.listMessages.mockRejectedValue(new Error('TypeError: undefined is not a function at line 42'));

    await renderApp();

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
    expect(screen.queryByText(/TypeError|line 42/)).not.toBeOnTheScreen();
  });
});

describe('Deleting a message', () => {
  async function openDeleteDialog() {
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete message: Quarterly report' }));
    return screen.getByText('Delete this message?');
  }

  it('asks for confirmation and does nothing when cancelled', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [summary()] });
    await renderApp();

    expect(await openDeleteDialog()).toBeOnTheScreen();
    expect(screen.getByText('"Quarterly report" will be permanently deleted.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete this message?')).not.toBeOnTheScreen();
    expect(mockedApi.deleteMessage).not.toHaveBeenCalled();
    expect(screen.getByText('Quarterly report')).toBeOnTheScreen();
  });

  it('shows progress, prevents duplicate requests and removes the message on success', async () => {
    mockedApi.listMessages.mockResolvedValueOnce({ items: [summary()] }).mockResolvedValue({ items: [] });
    const request = deferred<void>();
    mockedApi.deleteMessage.mockReturnValue(request.promise);
    await renderApp();
    await openDeleteDialog();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    // TanStack Query publishes the pending state on the next tick.
    const busyButton = await screen.findByRole('button', { name: 'Delete', busy: true });
    expect(busyButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await fireEvent.press(busyButton);

    expect(mockedApi.deleteMessage).toHaveBeenCalledTimes(1);
    expect(mockedApi.deleteMessage).toHaveBeenCalledWith('msg-1');

    request.resolve();

    await waitFor(() => expect(screen.queryByText('Delete this message?')).not.toBeOnTheScreen());
    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
  });

  it('keeps the message and allows retry when deletion fails', async () => {
    mockedApi.listMessages.mockResolvedValueOnce({ items: [summary()] }).mockResolvedValue({ items: [] });
    mockedApi.deleteMessage
      .mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Unavailable'))
      .mockResolvedValueOnce(undefined);
    await renderApp();
    await openDeleteDialog();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    const dialogError = await screen.findByText(/Couldn't delete the message\./);
    expect(dialogError).toBeOnTheScreen();
    expect(within(screen.getByRole('alert')).getByText('Error')).toBeOnTheScreen();
    // The message is still in the list behind the dialog.
    expect(screen.getByText('Quarterly report')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
    expect(mockedApi.deleteMessage).toHaveBeenCalledTimes(2);
  });
});
