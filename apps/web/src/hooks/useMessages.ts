import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createMessage, deleteMessage, getMessage, listMessages } from '../api/messages'
import type { Message, MessageCreate, MessageList } from '../api/types'

export const messageKeys = {
  all: ['messages'] as const,
  list: () => [...messageKeys.all, 'list'] as const,
  detail: (id: string) => [...messageKeys.all, 'detail', id] as const,
}

export function useMessageList() {
  return useQuery({ queryKey: messageKeys.list(), queryFn: ({ signal }) => listMessages(signal) })
}

export function useMessage(id: string) {
  return useQuery({ queryKey: messageKeys.detail(id), queryFn: ({ signal }) => getMessage(id, signal) })
}

export function useCreateMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: MessageCreate) => createMessage(data),
    onSuccess: (message: Message) => {
      // Show the new message immediately, then reconcile with the server.
      queryClient.setQueryData<MessageList>(messageKeys.list(), (current) =>
        current
          ? {
              items: [
                {
                  id: message.id,
                  subject: message.subject,
                  created_at: message.created_at,
                  has_attachment: message.attachment !== null,
                },
                ...current.items.filter((item) => item.id !== message.id),
              ],
            }
          : current,
      )
      queryClient.setQueryData(messageKeys.detail(message.id), message)
      return queryClient.invalidateQueries({ queryKey: messageKeys.list() })
    },
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<MessageList>(messageKeys.list(), (current) =>
        current ? { items: current.items.filter((item) => item.id !== id) } : current,
      )
      queryClient.removeQueries({ queryKey: messageKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: messageKeys.list() })
    },
  })
}
