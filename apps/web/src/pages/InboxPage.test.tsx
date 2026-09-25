import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import * as api from '../api/messages'
import { deferred, renderApp, summary } from '../test/renderApp'

vi.mock('../api/messages')
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('Inbox', () => {
  it('lists messages with subject as the link and date/time as secondary text', async () => {
    mockedApi.listMessages.mockResolvedValue({
      items: [
        summary({ id: 'a', subject: 'Quarterly report', created_at: '2026-09-25T07:28:00Z' }),
        summary({ id: 'b', subject: 'Team lunch', created_at: '2026-01-03T18:05:00Z', has_attachment: true }),
      ],
    })

    renderApp()

    const link = await screen.findByRole('link', { name: /Quarterly report/ })
    expect(link).toHaveAttribute('href', '/messages/a')
    expect(within(link).getByText('25.09.2026, 07:28')).toHaveAttribute('datetime', '2026-09-25T07:28:00Z')
    expect(screen.getByRole('link', { name: /Team lunch.*Attachment/ })).toBeInTheDocument()
    expect(screen.getByText('2 messages')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Messages' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New message' })).toHaveAttribute('href', '/messages/new')
  })

  it('shows a skeleton, not the empty state, while loading', async () => {
    const request = deferred<{ items: never[] }>()
    mockedApi.listMessages.mockReturnValue(request.promise)

    renderApp()

    expect(screen.getByRole('status', { name: 'Loading messages' })).toBeInTheDocument()
    expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument()

    request.resolve({ items: [] })
    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument()
  })

  it('shows a friendly empty state leading to the create page', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [] })
    const { user } = renderApp()

    await user.click(await screen.findByRole('link', { name: 'Write your first message' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'New message' })).toBeInTheDocument()
  })

  it('shows an error with retry and recovers', async () => {
    mockedApi.listMessages
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'Could not reach the server.'))
      .mockResolvedValueOnce({ items: [summary({ subject: 'Back online' })] })
    const { user } = renderApp()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load your messagesCan't reach the server. Check your connection and try again.",
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('link', { name: /Back online/ })).toBeInTheDocument()
  })

  it('never shows internal error details', async () => {
    mockedApi.listMessages.mockRejectedValue(new Error('TypeError: x is undefined at line 42'))

    renderApp()

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(/TypeError|line 42/)).not.toBeInTheDocument()
  })

  it('is fully operable with the keyboard', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [summary()] })
    const { user } = renderApp()
    await screen.findByRole('link', { name: /Quarterly report/ })

    // Focus starts on the page heading after navigation; Tab continues from there.
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'New message' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /Quarterly report/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Delete message: Quarterly report' })).toHaveFocus()

    // Enter on the focused delete button opens the dialog with focus on Cancel.
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('offers a skip link as the first tab stop', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [] })
    const { user } = renderApp()
    await screen.findByText('Your inbox is empty')
    ;(document.activeElement as HTMLElement | null)?.blur()

    await user.tab()

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
  })
})

describe('Deleting from the inbox', () => {
  it('asks for confirmation, focusing the safe choice, and cancels without deleting', async () => {
    mockedApi.listMessages.mockResolvedValue({ items: [summary()] })
    const { user } = renderApp()

    await user.click(await screen.findByRole('button', { name: 'Delete message: Quarterly report' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete this message?' })
    expect(dialog).toHaveAccessibleDescription('"Quarterly report" will be permanently deleted.')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockedApi.deleteMessage).not.toHaveBeenCalled()
  })

  it('disables the dialog while deleting, sends one request and removes the message', async () => {
    mockedApi.listMessages.mockResolvedValueOnce({ items: [summary()] }).mockResolvedValue({ items: [] })
    const request = deferred<void>()
    mockedApi.deleteMessage.mockReturnValue(request.promise)
    const { user } = renderApp()

    await user.click(await screen.findByRole('button', { name: 'Delete message: Quarterly report' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled())
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-busy', 'true')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(mockedApi.deleteMessage).toHaveBeenCalledTimes(1)
    expect(mockedApi.deleteMessage).toHaveBeenCalledWith('msg-1')

    request.resolve()

    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted "Quarterly report".')).toBeInTheDocument()
    // Focus is not lost to <body> when the deleted row disappears.
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toHaveFocus()
  })

  it('keeps the message and offers retry when deletion fails', async () => {
    mockedApi.listMessages.mockResolvedValueOnce({ items: [summary()] }).mockResolvedValue({ items: [] })
    mockedApi.deleteMessage
      .mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Unavailable'))
      .mockResolvedValueOnce(undefined)
    const { user } = renderApp()

    await user.click(await screen.findByRole('button', { name: 'Delete message: Quarterly report' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Couldn't delete the message. The service is temporarily unavailable.",
    )
    expect(screen.getByRole('link', { name: /Quarterly report/, hidden: true })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument()
    expect(mockedApi.deleteMessage).toHaveBeenCalledTimes(2)
  })
})
