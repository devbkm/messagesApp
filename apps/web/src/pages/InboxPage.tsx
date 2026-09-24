import { ButtonLink, EmptyState, PageContainer } from '../components/ui'

// Placeholder: the message list is implemented in a later phase.
export function InboxPage() {
  return (
    <PageContainer title="Inbox" actions={<ButtonLink to="/messages/new">New message</ButtonLink>}>
      <EmptyState title="No messages yet" message="Messages you create will appear here." />
    </PageContainer>
  )
}
