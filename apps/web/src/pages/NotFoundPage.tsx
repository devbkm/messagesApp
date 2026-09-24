import { ButtonLink, EmptyState, PageContainer } from '../components/ui'

export function NotFoundPage() {
  return (
    <PageContainer title="Page not found">
      <EmptyState
        title="This page doesn't exist"
        message="Check the address, or go back to your inbox."
        action={<ButtonLink to="/">Go to inbox</ButtonLink>}
      />
    </PageContainer>
  )
}
