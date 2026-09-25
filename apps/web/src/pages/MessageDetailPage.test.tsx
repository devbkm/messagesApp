import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import * as api from '../api/messages'
import { deferred, fullMessage, renderApp, summary } from '../test/renderApp'

vi.mock('../api/messages')
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
  mockedApi.listMessages.mockResolvedValue({ items: [summary()] })
})

describe('Message detail', () => {
  it('opens as a separate page from the inbox and shows subject, date/time and text', async () => {
    mockedApi.getMessage.mockResolvedValue(fullMessage({ text: 'Line one\nLine two' }))
    const { user, router } = renderApp()

    await user.click(await screen.findByRole('link', { name: /Quarterly report/ }))

    const heading = await screen.findByRole('heading', { level: 1, name: 'Quarterly report' })
    expect(router.state.location.pathname).toBe('/messages/msg-1')
    expect(heading).toHaveFocus()
    expect(screen.getByText('25.09.2026, 07:28')).toHaveAttribute('datetime', '2026-09-25T07:28:00Z')
    expect(screen.getByText(/Line one\s+Line two/)).toBeInTheDocument()
    expect(document.title).toBe('Quarterly report · Inbox')
    expect(mockedApi.getMessage).toHaveBeenCalledWith('msg-1', expect.anything())
  })

  it('shows attachment details when present', async () => {
    mockedApi.getMessage.mockResolvedValue(
      fullMessage({ attachment: { filename: 'report.pdf', content_type: 'application/pdf', size_bytes: 2048 } }),
    )

    renderApp('/messages/msg-1')

    expect(await screen.findByRole('heading', { level: 2, name: 'Attachment' })).toBeInTheDocument()
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('application/pdf · 2.0 KB')).toBeInTheDocument()
  })

  it('shows a loading state', async () => {
    const request = deferred<ReturnType<typeof fullMessage>>()
    mockedApi.getMessage.mockReturnValue(request.promise)

    renderApp('/messages/msg-1')

    expect(screen.getByRole('status')).toHaveTextContent('Loading message…')
    request.resolve(fullMessage())
    expect(await screen.findByRole('heading', { level: 1, name: 'Quarterly report' })).toBeInTheDocument()
  })

  it('explains a missing message and links back to the inbox', async () => {
    mockedApi.getMessage.mockRejectedValue(new ApiError(404, 'not_found', 'Message not found.'))
    const { user } = renderApp('/messages/gone')

    expect(await screen.findByRole('heading', { level: 1, name: 'Message not found' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back to inbox' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument()
  })

  it('offers retry after a failure', async () => {
    mockedApi.getMessage
      .mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Unavailable'))
      .mockResolvedValueOnce(fullMessage())
    const { user } = renderApp('/messages/msg-1')

    expect(await screen.findByText("Couldn't load this message")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Quarterly report' })).toBeInTheDocument()
  })
})
