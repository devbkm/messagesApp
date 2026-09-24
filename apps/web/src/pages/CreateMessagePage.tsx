import { ButtonLink, EmptyState, PageContainer } from '../components/ui'

// Placeholder: the create-message form is implemented in a later phase.
export function CreateMessagePage() {
  return (
    <PageContainer
      title="New message"
      backLink={
        <ButtonLink to="/" variant="ghost">
          ← Back to inbox
        </ButtonLink>
      }
    >
      <EmptyState title="New message" message="The form for writing a message will appear here." />
    </PageContainer>
  )
}
