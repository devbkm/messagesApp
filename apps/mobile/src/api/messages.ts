import { apiRequest } from './client';
import type { Message, MessageCreate, MessageList } from './types';

const BASE = '/api/v1/messages';

export function listMessages(): Promise<MessageList> {
  return apiRequest<MessageList>(BASE);
}

export function getMessage(id: string): Promise<Message> {
  return apiRequest<Message>(`${BASE}/${encodeURIComponent(id)}`);
}

export function createMessage(data: MessageCreate): Promise<Message> {
  return apiRequest<Message>(BASE, { method: 'POST', body: data });
}

export function deleteMessage(id: string): Promise<void> {
  return apiRequest<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
