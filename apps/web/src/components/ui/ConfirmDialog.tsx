import { useEffect, useId, useRef, type RefObject } from 'react'

import { Button } from './Button'
import { InlineError } from './StateViews'
import styles from './ConfirmDialog.module.css'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  /** Styles the confirm action as destructive. */
  destructive?: boolean
  /** Shows progress on the confirm button and blocks dismissal while an action runs. */
  busy?: boolean
  /** Shown inside the dialog when the action failed; the user can retry or cancel. */
  error?: string
  /**
   * Where focus goes after closing if the element that opened the dialog no longer
   * exists (e.g. the row of a message that was just deleted).
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal confirmation built on the native <dialog> element, which provides focus
 * trapping, Escape-to-close and inert background content. Focus starts on Cancel
 * so a stray Enter never triggers the destructive action; the browser restores
 * focus to the triggering element on close.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  error,
  fallbackFocusRef,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      // The browser restores focus to the opener; if that is gone, focus is left on
      // <body> (or inside the closed dialog), so move it somewhere meaningful instead.
      const active = document.activeElement
      if (!active || active === document.body || dialog.contains(active)) {
        fallbackFocusRef?.current?.focus()
      }
    }
  }, [open, fallbackFocusRef])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        // Escape key: keep React state as the source of truth.
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p id={messageId} className={styles.message}>
        {message}
      </p>
      {error ? (
        <div className={styles.error}>
          <InlineError message={error} />
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
