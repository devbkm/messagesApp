import { apiRequest, invalidResponse } from './client'
import type { Message, MessageCreate, MessageList, MessageSummary } from './types'

const BASE = '/api/v1/messages'

export async function listMessages(signal?: AbortSignal): Promise<MessageList> {
  const data = await apiRequest<unknown>(BASE, { signal })
  if (!isMessageList(data)) throw invalidResponse()
  return data
}

export async function getMessage(id: string, signal?: AbortSignal): Promise<Message> {
  const data = await apiRequest<unknown>(`${BASE}/${encodeURIComponent(id)}`, { signal })
  if (!isMessage(data)) throw invalidResponse()
  return data
}

export async function createMessage(input: MessageCreate): Promise<Message> {
  const data = await apiRequest<unknown>(BASE, { method: 'POST', body: input })
  if (!isMessage(data)) throw invalidResponse()
  return data
}

export function deleteMessage(id: string): Promise<void> {
  return apiRequest<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// --- Response guards ---------------------------------------------------------------
// The UI never renders data it has not checked: a malformed response becomes a
// normal, recoverable error instead of a crash.

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null
const isString = (value: unknown): value is string => typeof value === 'string'
const isDate = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))

function isSummary(value: unknown): value is MessageSummary {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.subject) &&
    isDate(value.created_at) &&
    typeof value.has_attachment === 'boolean'
  )
}

function isMessageList(value: unknown): value is MessageList {
  return isObject(value) && Array.isArray(value.items) && value.items.every(isSummary)
}

function isAttachment(value: unknown): boolean {
  return (
    isObject(value) &&
    isString(value.filename) &&
    isString(value.content_type) &&
    typeof value.size_bytes === 'number'
  )
}

function isMessage(value: unknown): value is Message {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.subject) &&
    isString(value.text) &&
    isDate(value.created_at) &&
    (value.attachment === null || isAttachment(value.attachment))
  )
}
