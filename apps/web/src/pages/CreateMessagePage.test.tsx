import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/client'
import * as api from '../api/messages'
import type { Message } from '../api/types'
import { deferred, fullMessage, renderApp, summary } from '../test/renderApp'

vi.mock('../api/messages')
const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.resetAllMocks()
  mockedApi.listMessages.mockResolvedValue({ items: [summary({ id: 'old', subject: 'Older message' })] })
})

async function openForm() {
  const app = renderApp('/messages/new')
  await screen.findByRole('textbox', { name: 'Subject (required)' })
  return {
    ...app,
    subject: () => screen.getByRole('textbox', { name: 'Subject (required)' }),
    text: () => screen.getByRole('textbox', { name: 'Message (required)' }),
    submit: () => screen.getByRole('button', { name: /Create message|Creating…/ }),
  }
}

describe('Create message form', () => {
  it('has labelled fields, placeholders, hint and a character counter', async () => {
    const { user, subject, text } = await openForm()

    expect(subject()).toHaveAttribute('placeholder', 'What is it about?')
    expect(text()).toHaveAttribute('placeholder', 'Write your message…')
    expect(subject()).toHaveAccessibleDescription('Up to 40 characters. 0/40 characters used')

    await user.type(subject(), 'Hello')

    expect(subject()).toHaveAccessibleDescription('Up to 40 characters. 5/40 characters used')
  })

  it('shows inline errors on submit, focuses the first invalid field and does not call the API', async () => {
    const { user, subject, text, submit } = await openForm()

    await user.click(submit())

    expect(subject()).toHaveAttribute('aria-invalid', 'true')
    expect(subject()).toHaveAccessibleDescription(/Error: Enter a subject\./)
    expect(text()).toHaveAccessibleDescription(/Error: Enter a message\./)
    expect(subject()).toHaveFocus()
    expect(mockedApi.createMessage).not.toHaveBeenCalled()
  })

  it('reports an over-long subject while typing and does not truncate it', async () => {
    const { user, subject } = await openForm()

    await user.type(subject(), 'x'.repeat(42))

    expect(subject()).toHaveValue('x'.repeat(42))
    expect(subject()).toHaveAccessibleDescription(/Error: Subject is 2 characters too long \(max 40\)\./)
    expect(screen.getByText('42/40')).toBeInTheDocument()
  })

  it('treats whitespace-only input as empty', async () => {
    const { user, subject, text, submit } = await openForm()

    await user.type(subject(), '   ')
    await user.type(text(), '   ')
    await user.click(submit())

    expect(subject()).toHaveAccessibleDescription(/Enter a subject\./)
    expect(mockedApi.createMessage).not.toHaveBeenCalled()
  })

  it('submits once, shows progress, then shows the new message in the inbox', async () => {
    const request = deferred<Message>()
    mockedApi.createMessage.mockReturnValue(request.promise)
    const { user, subject, text, submit, router } = await openForm()

    await user.type(subject(), '  Weekly update  ')
    await user.type(text(), 'All good this week.')
    await user.click(submit())

    await waitFor(() => expect(submit()).toBeDisabled())
    expect(submit()).toHaveTextContent('Creating…')
    await user.click(submit())
    await user.keyboard('{Enter}')
    expect(mockedApi.createMessage).toHaveBeenCalledTimes(1)
    expect(mockedApi.createMessage).toHaveBeenCalledWith({ subject: 'Weekly update', text: 'All good this week.' })

    mockedApi.listMessages.mockResolvedValue({
      items: [summary({ id: 'new', subject: 'Weekly update' }), summary({ id: 'old', subject: 'Older message' })],
    })
    request.resolve(fullMessage({ id: 'new', subject: 'Weekly update' }))

    expect(await screen.findByRole('link', { name: /Weekly update/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the input and allows retry when saving fails', async () => {
    mockedApi.createMessage
      .mockRejectedValueOnce(new ApiError(0, 'network_error', 'Could not reach the server.'))
      .mockResolvedValueOnce(fullMessage({ id: 'new', subject: 'Retry me' }))
    const { user, subject, text, submit, router } = await openForm()

    await user.type(subject(), 'Retry me')
    await user.type(text(), 'Important content')
    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your message wasn't saved. Can't reach the server. Check your connection and try again.",
    )
    expect(subject()).toHaveValue('Retry me')
    expect(text()).toHaveValue('Important content')
    expect(router.state.location.pathname).toBe('/messages/new')

    await user.click(submit())

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(mockedApi.createMessage).toHaveBeenCalledTimes(2)
  })

  it('shows server-side field errors next to the field', async () => {
    mockedApi.createMessage.mockRejectedValue(
      new ApiError(422, 'validation_error', 'The request is invalid.', {
        subject: 'String should have at most 40 characters',
      }),
    )
    const { user, subject, text, submit } = await openForm()

    await user.type(subject(), 'Valid locally')
    await user.type(text(), 'Body')
    await user.click(submit())

    await waitFor(() =>
      expect(subject()).toHaveAccessibleDescription(/Error: String should have at most 40 characters/),
    )
  })
})

describe('Leaving with a draft', () => {
  it('leaves immediately when nothing was typed', async () => {
    const { user } = await openForm()

    await user.click(screen.getByRole('link', { name: 'Cancel' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument()
  })

  it('asks before discarding, and keeps the draft when the user continues', async () => {
    const { user, subject, router } = await openForm()
    await user.type(subject(), 'Half-written')

    await user.click(screen.getByRole('link', { name: 'Cancel' }))
    const dialog = await screen.findByRole('dialog', { name: 'Discard this message?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))

    expect(subject()).toHaveValue('Half-written')
    expect(router.state.location.pathname).toBe('/messages/new')

    await user.click(screen.getByRole('link', { name: 'Back to inbox' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument()
    expect(mockedApi.createMessage).not.toHaveBeenCalled()
  })
})
