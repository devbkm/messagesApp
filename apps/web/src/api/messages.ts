import { apiRequest } from './client'
import type { Message, MessageCreate, MessageList } from './types'

const BASE = '/api/v1/messages'

export function listMessages(signal?: AbortSignal): Promise<MessageList> {
  return apiRequest<MessageList>(BASE, { signal })
}

export function getMessage(id: string, signal?: AbortSignal): Promise<Message> {
  return apiRequest<Message>(`${BASE}/${encodeURIComponent(id)}`, { signal })
}

export function createMessage(data: MessageCreate): Promise<Message> {
  return apiRequest<Message>(BASE, { method: 'POST', body: data })
}

export function deleteMessage(id: string): Promise<void> {
  return apiRequest<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
