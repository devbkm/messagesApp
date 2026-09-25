import type { ReactNode } from 'react'

import { Button } from './Button'
import { Spinner } from './Spinner'
import styles from './StateViews.module.css'

/** Loading indicator with a visible label announced to screen readers. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.centered} role="status">
      <Spinner />
      <p className={styles.muted}>{label}</p>
    </div>
  )
}

type ErrorStateProps = {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  /** Replaces the retry button when retrying cannot help (e.g. "not found"). */
  action?: ReactNode
}

/** Error with a plain-language explanation and an optional retry action. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  action,
}: ErrorStateProps) {
  return (
    <div className={styles.centered}>
      <div role="alert" className={styles.text}>
        <h2 className={styles.heading}>{title}</h2>
        <p className={styles.muted}>{message}</p>
      </div>
      {action ??
        (onRetry ? (
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        ) : null)}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  message?: string
  action?: ReactNode
}

/** Explains why a view is empty and, where possible, what to do next. */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className={styles.centered}>
      <div className={styles.text}>
        <h2 className={styles.heading}>{title}</h2>
        {message ? <p className={styles.muted}>{message}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Inline error banner, e.g. for a failed form submission. */
export function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className={styles.banner}>
      <strong>Error</strong>
      <p>{message}</p>
    </div>
  )
}

/** Neutral information banner, e.g. "Your session has expired". */
export function NoticeBanner({ message }: { message: string }) {
  return (
    <div role="status" className={styles.notice}>
      <p>{message}</p>
    </div>
  )
}
