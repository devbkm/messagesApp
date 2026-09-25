import { fireEvent, screen } from '@testing-library/react-native';

import { ApiError } from '../api/client';
import * as api from '../api/messages';
import { deferred, fullMessage, renderApp, summary, resetMocks } from '../test-utils/renderApp';

jest.mock('../api/messages');
const mockedApi = jest.mocked(api);

beforeEach(() => {
  resetMocks(mockedApi);
  mockedApi.listMessages.mockResolvedValue({ items: [summary({ id: 'msg-1', subject: 'Quarterly report' })] });
});

async function openMessage() {
  await renderApp();
  await fireEvent.press(await screen.findByText('Quarterly report'));
}

describe('Navigation', () => {
  it('opens a separate detail screen when a message is tapped, and goes back', async () => {
    mockedApi.getMessage.mockResolvedValue(fullMessage());

    await openMessage();

    expect(await screen.findByTestId('message-subject')).toHaveTextContent('Quarterly report');
    expect(mockedApi.getMessage).toHaveBeenCalledWith('msg-1');
    // The inbox list is no longer the visible screen content.
    expect(screen.queryByRole('button', { name: 'New message' })).not.toBeOnTheScreen();
  });
});

describe('Message detail', () => {
  it('shows subject, date/time and the full text', async () => {
    const longText = 'Paragraph one.\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(200);
    mockedApi.getMessage.mockResolvedValue(fullMessage({ text: longText }));

    await openMessage();

    expect(await screen.findByTestId('message-subject')).toHaveTextContent('Quarterly report');
    expect(screen.getByText('25.09.2026, 07:28')).toBeOnTheScreen();
    expect(screen.getByLabelText('Created 25 September 2026 at 07:28')).toBeOnTheScreen();
    expect(screen.getByText(longText)).toBeOnTheScreen();
    expect(screen.queryByTestId('message-attachment')).not.toBeOnTheScreen();
  });

  it('shows attachment details when present', async () => {
    mockedApi.getMessage.mockResolvedValue(
      fullMessage({ attachment: { filename: 'report.pdf', content_type: 'application/pdf', size_bytes: 2048 } }),
    );

    await openMessage();

    expect(await screen.findByText('report.pdf')).toBeOnTheScreen();
    expect(screen.getByText('application/pdf · 2.0 KB')).toBeOnTheScreen();
    expect(screen.getByLabelText('Attachment: report.pdf, application/pdf · 2.0 KB')).toBeOnTheScreen();
  });

  it('shows a loading state while the message loads', async () => {
    const request = deferred<ReturnType<typeof fullMessage>>();
    mockedApi.getMessage.mockReturnValue(request.promise);

    await openMessage();

    expect(await screen.findByLabelText('Loading message')).toBeOnTheScreen();
    request.resolve(fullMessage());
    expect(await screen.findByTestId('message-subject')).toBeOnTheScreen();
  });

  it('explains when the message no longer exists and offers a way back', async () => {
    mockedApi.getMessage.mockRejectedValue(new ApiError(404, 'not_found', 'Message not found.'));

    await openMessage();

    expect(await screen.findByText('Message not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to inbox' }));
    // The missing message is also dropped from the inbox, which is now empty.
    expect(await screen.findByText('Your inbox is empty')).toBeOnTheScreen();
  });

  it('offers retry after a failure', async () => {
    mockedApi.getMessage
      .mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Unavailable'))
      .mockResolvedValueOnce(fullMessage());

    await openMessage();

    expect(await screen.findByText("Couldn't load this message")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('message-subject')).toHaveTextContent('Quarterly report');
  });
});
