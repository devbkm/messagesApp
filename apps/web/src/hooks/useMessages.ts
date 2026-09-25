import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { createMessage, deleteMessage, getMessage, listMessages } from '../api/messages'
import type { Message, MessageCreate, MessageList } from '../api/types'
import { isNotFound } from '../utils/errors'

export const messageKeys = {
  all: ['messages'] as const,
  list: () => [...messageKeys.all, 'list'] as const,
  detail: (id: string) => [...messageKeys.all, 'detail', id] as const,
}

export function useMessageList() {
  return useQuery({ queryKey: messageKeys.list(), queryFn: ({ signal }) => listMessages(signal) })
}

/** Drops a message from the cached inbox list, e.g. when it turns out to be gone. */
function removeFromList(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<MessageList>(messageKeys.list(), (current) =>
    current ? { items: current.items.filter((item) => item.id !== id) } : current,
  )
}

export function useMessage(id: string) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: messageKeys.detail(id),
    queryFn: async ({ signal }) => {
      try {
        return await getMessage(id, signal)
      } catch (error) {
        // Deleted elsewhere (another tab or device): keep the inbox from showing a ghost row.
        if (isNotFound(error)) removeFromList(queryClient, id)
        throw error
      }
    },
  })
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
    mutationFn: async (id: string) => {
      try {
        await deleteMessage(id)
      } catch (error) {
        // Already deleted (e.g. in another tab): the user's intent is fulfilled.
        if (!isNotFound(error)) throw error
      }
    },
    onSuccess: (_result, id) => {
      removeFromList(queryClient, id)
      queryClient.removeQueries({ queryKey: messageKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: messageKeys.list() })
    },
  })
}
