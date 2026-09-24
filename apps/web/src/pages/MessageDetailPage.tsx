import { ButtonLink, EmptyState, PageContainer } from '../components/ui'

// Placeholder: loading and displaying a message is implemented in a later phase.
export function MessageDetailPage() {
  return (
    <PageContainer
      title="Message"
      backLink={
        <ButtonLink to="/" variant="ghost">
          ← Back to inbox
        </ButtonLink>
      }
    >
      <EmptyState title="Message details" message="The subject, date and text of a message will appear here." />
    </PageContainer>
  )
}
