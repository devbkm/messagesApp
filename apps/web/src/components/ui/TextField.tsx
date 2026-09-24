import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import styles from './TextField.module.css'

type SharedProps = {
  label: string
  /** Guidance shown below the field while there is no error. */
  hint?: string
  error?: string
  /** Shows a "used / max" counter when `maxLength` is set. */
  showCount?: boolean
}

type InputFieldProps = SharedProps & { multiline?: false } & InputHTMLAttributes<HTMLInputElement>
type TextareaFieldProps = SharedProps & { multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Labelled input or textarea. The label is always visible and programmatically
 * associated, hints and errors are linked via aria-describedby, and errors are
 * conveyed with text as well as colour.
 */
export function TextField(props: InputFieldProps | TextareaFieldProps) {
  const { label, hint, error, showCount = false, id, required, maxLength, value } = props
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-message`
  const countId = `${fieldId}-count`
  const length = typeof value === 'string' ? value.length : 0
  const hasCount = showCount && typeof maxLength === 'number'
  const describedBy = [error || hint ? messageId : null, hasCount ? countId : null].filter(Boolean).join(' ')

  const fieldProps = {
    id: fieldId,
    className: `${styles.input} ${error ? styles.invalid : ''}`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  }

  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required ? <span className={styles.required}> (required)</span> : null}
      </label>
      {props.multiline ? (
        <textarea {...stripShared(props)} {...fieldProps} className={`${fieldProps.className} ${styles.textarea}`} />
      ) : (
        <input {...stripShared(props)} {...fieldProps} />
      )}
      <div className={styles.footer}>
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {error ? (
            <>
              <span className="visually-hidden">Error: </span>
              {error}
            </>
          ) : (
            hint
          )}
        </p>
        {hasCount ? (
          <p id={countId} className={length >= maxLength ? styles.countLimit : styles.count} aria-live="polite">
            {length}/{maxLength}
            <span className="visually-hidden"> characters used</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function stripShared<T extends SharedProps & { multiline?: boolean }>(props: T) {
  const { label, hint, error, showCount, multiline, ...rest } = props
  return rest
}
