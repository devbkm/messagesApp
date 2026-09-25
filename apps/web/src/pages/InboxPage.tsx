import { useRef, useState } from 'react'

import type { MessageSummary } from '../api/types'
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  InlineError,
  ListRow,
  ListSkeleton,
  PageContainer,
} from '../components/ui'
import { useDeleteMessage, useMessageList } from '../hooks/useMessages'
import { describeError } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import styles from './InboxPage.module.css'

export function InboxPage() {
  const messages = useMessageList()
  const deletion = useDeleteMessage()
  // The target outlives the dialog's visibility so its text stays intact while closing.
  const [pendingDelete, setPendingDelete] = useState<MessageSummary | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const askToDelete = (message: MessageSummary) => {
    deletion.reset()
    setPendingDelete(message)
    setDialogOpen(true)
  }

  const confirmDelete = () => {
    // Guard against double clicks while the request is in flight.
    if (!dialogOpen || !pendingDelete || deletion.isPending) return
    deletion.mutate(pendingDelete.id, {
      onSuccess: () => {
        setDialogOpen(false)
        setAnnouncement(`Deleted "${pendingDelete.subject}".`)
      },
    })
  }

  const cancelDelete = () => {
    if (deletion.isPending) return
    setDialogOpen(false)
  }

  const items = messages.data?.items
  const isEmpty = items !== undefined && items.length === 0

  let content
  if (messages.isPending) {
    // Skeleton, not an empty state: we do not know yet whether the inbox is empty.
    content = <ListSkeleton label="Loading messages" />
  } else if (messages.isError && !items) {
    content = (
      <ErrorState
        title="Couldn't load your messages"
        message={describeError(messages.error)}
        onRetry={() => void messages.refetch()}
        retrying={messages.isFetching}
      />
    )
  } else if (isEmpty) {
    content = (
      <EmptyState
        title="Your inbox is empty"
        message="Messages you write are kept here. Create your first one to get started."
        action={
          <ButtonLink to="/messages/new">
            <Icon name="plus" size={18} />
            Write your first message
          </ButtonLink>
        }
      />
    )
  } else {
    content = (
      <section aria-labelledby="messages-heading" className={styles.section}>
        <h2 id="messages-heading" className="visually-hidden">
          Messages
        </h2>
        {messages.isRefetchError ? (
          <div className={styles.refreshError}>
            <InlineError message={`Couldn't refresh. ${describeError(messages.error)}`} />
            <Button variant="secondary" onClick={() => void messages.refetch()} loading={messages.isFetching}>
              Try again
            </Button>
          </div>
        ) : null}
        <ul className={styles.list}>
          {items!.map((message) => (
            <ListRow
              key={message.id}
              to={`/messages/${message.id}`}
              title={message.subject}
              meta={
                <>
                  <time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>
                  {message.has_attachment ? (
                    <span className={styles.attachment}>
                      <Icon name="paperclip" size={14} />
                      Attachment
                    </span>
                  ) : null}
                </>
              }
              trailing={
                <Button
                  variant="ghost"
                  className={styles.deleteButton}
                  aria-label={`Delete message: ${message.subject}`}
                  onClick={() => askToDelete(message)}
                >
                  <Icon name="trash" size={18} />
                  <span className={styles.deleteLabel}>Delete</span>
                </Button>
              }
            />
          ))}
        </ul>
      </section>
    )
  }

  return (
    <PageContainer
      title="Inbox"
      subtitle={items && items.length > 0 ? `${countLabel(items.length)} · newest first` : undefined}
      headingRef={headingRef}
      actions={
        isEmpty ? undefined : (
          <ButtonLink to="/messages/new">
            <Icon name="plus" size={18} />
            New message
          </ButtonLink>
        )
      }
    >
      {content}
      <ConfirmDialog
        open={dialogOpen}
        title="Delete this message?"
        message={pendingDelete ? `"${pendingDelete.subject}" will be permanently deleted.` : ''}
        confirmLabel={deletion.isError ? 'Try again' : 'Delete'}
        destructive
        busy={deletion.isPending}
        fallbackFocusRef={headingRef}
        error={deletion.isError ? `Couldn't delete the message. ${describeError(deletion.error)}` : undefined}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
      <p role="status" className="visually-hidden">
        {announcement}
      </p>
    </PageContainer>
  )
}

function countLabel(count: number) {
  return count === 1 ? '1 message' : `${count} messages`
}
