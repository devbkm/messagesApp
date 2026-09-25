import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'

import { ApiError } from '../api/client'
import { Button, ButtonLink, ConfirmDialog, InlineError, PageContainer, TextField } from '../components/ui'
import { useCreateMessage } from '../hooks/useMessages'
import { describeError } from '../utils/errors'
import { SUBJECT_MAX_LENGTH, effectiveLength, validateMessage, type MessageFormValues } from '../utils/validation'
import styles from './CreateMessagePage.module.css'

type Field = keyof MessageFormValues

export function CreateMessagePage() {
  const navigate = useNavigate()
  const creation = useCreateMessage()
  const subjectRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [values, setValues] = useState<MessageFormValues>({ subject: '', text: '' })
  const [touched, setTouched] = useState<Record<Field, boolean>>({ subject: false, text: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [created, setCreated] = useState(false)

  const errors = validateMessage(values)
  const serverErrors = creation.error instanceof ApiError ? creation.error.fieldErrors : {}
  const subjectLength = effectiveLength(values.subject)

  // "Required" errors appear once a field was left or a submit was attempted; an
  // over-long subject is reported immediately while typing.
  const visibleError = (field: Field): string | undefined => {
    const error = errors[field]
    if (!error) return serverErrors[field]
    if (submitAttempted || touched[field]) return error
    if (field === 'subject' && subjectLength > SUBJECT_MAX_LENGTH) return error
    return undefined
  }

  // Ask before throwing away a draft: in-app navigation, and closing/reloading the tab.
  const hasDraft = values.subject.trim() !== '' || values.text.trim() !== ''
  const guardActive = hasDraft && !created
  const blocker = useBlocker(guardActive)
  useEffect(() => {
    if (!guardActive) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [guardActive])

  // Leave once the "created" state has rendered, so the draft guard is already off.
  useEffect(() => {
    if (created) navigate('/')
  }, [created, navigate])

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (creation.isError) creation.reset()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (creation.isPending) return // prevent duplicate submissions
    setSubmitAttempted(true)

    if (errors.subject || errors.text) {
      ;(errors.subject ? subjectRef : textRef).current?.focus()
      return
    }

    creation.mutate(
      { subject: values.subject.trim(), text: values.text.trim() },
      { onSuccess: () => setCreated(true) },
    )
  }

  return (
    <PageContainer
      title="New message"
      backLink={
        <ButtonLink to="/" variant="ghost">
          ← Back to inbox
        </ButtonLink>
      }
    >
      <form className={styles.form} onSubmit={submit} noValidate aria-busy={creation.isPending || undefined}>
        <TextField
          ref={subjectRef}
          label="Subject"
          required
          placeholder="What is it about?"
          value={values.subject}
          onChange={(event) => update('subject')(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
          error={visibleError('subject')}
          hint={`Up to ${SUBJECT_MAX_LENGTH} characters.`}
          counter={{ count: subjectLength, limit: SUBJECT_MAX_LENGTH }}
          autoComplete="off"
          readOnly={creation.isPending}
        />
        <TextField
          ref={textRef}
          multiline
          label="Message"
          required
          placeholder="Write your message…"
          rows={8}
          value={values.text}
          onChange={(event) => update('text')(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, text: true }))}
          error={visibleError('text')}
          readOnly={creation.isPending}
        />

        {creation.isError ? (
          <InlineError message={`Your message wasn't saved. ${describeError(creation.error)}`} />
        ) : null}

        <div className={styles.actions}>
          <ButtonLink to="/" variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" loading={creation.isPending}>
            {creation.isPending ? 'Creating…' : 'Create message'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard this message?"
        message="What you have written will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </PageContainer>
  )
}
