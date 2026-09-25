import { useParams } from 'react-router-dom'

import type { Attachment } from '../api/types'
import { ButtonLink, ErrorState, Icon, LoadingState, PageContainer } from '../components/ui'
import { useMessage } from '../hooks/useMessages'
import { describeError, isNotFound } from '../utils/errors'
import { formatDateTime, formatFileSize } from '../utils/format'
import styles from './MessageDetailPage.module.css'

const backLink = (
  <ButtonLink to="/" variant="ghost">
    <Icon name="arrowLeft" size={18} />
    Back to inbox
  </ButtonLink>
)

export function MessageDetailPage() {
  const { messageId = '' } = useParams()
  const { data: message, isPending, isError, error, refetch, isFetching } = useMessage(messageId)

  if (isPending) {
    return (
      <PageContainer title="Message" backLink={backLink}>
        <LoadingState label="Loading message…" />
      </PageContainer>
    )
  }

  if (isError) {
    return isNotFound(error) ? (
      <PageContainer title="Message not found" backLink={backLink}>
        <ErrorState
          title="This message doesn't exist"
          message="It may have been deleted. Go back to your inbox to see your current messages."
          action={<ButtonLink to="/">Go to inbox</ButtonLink>}
        />
      </PageContainer>
    ) : (
      <PageContainer title="Message" backLink={backLink}>
        <ErrorState
          title="Couldn't load this message"
          message={describeError(error)}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={message.subject}
      backLink={backLink}
      subtitle={<time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time>}
    >
      <article className={styles.article}>
        <p className={styles.body}>{message.text}</p>
        {message.attachment ? <AttachmentCard attachment={message.attachment} /> : null}
      </article>
    </PageContainer>
  )
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  return (
    <section className={styles.attachment} aria-labelledby="attachment-heading">
      <h2 id="attachment-heading" className={styles.attachmentHeading}>
        Attachment
      </h2>
      <p className={styles.attachmentName}>{attachment.filename}</p>
      <p className={styles.attachmentMeta}>
        {attachment.content_type} · {formatFileSize(attachment.size_bytes)}
      </p>
    </section>
  )
}
