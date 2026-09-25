import { useId, type ComponentPropsWithRef } from 'react'

import styles from './TextField.module.css'

type SharedProps = {
  label: string
  /** Guidance shown below the field while there is no error. */
  hint?: string
  error?: string
  /**
   * Shows "count/limit". Unlike `maxLength` it does not truncate input, so pasted
   * text is never silently cut off; the form explains the problem instead.
   */
  counter?: { count: number; limit: number }
}

type InputFieldProps = SharedProps & { multiline?: false } & ComponentPropsWithRef<'input'>
type TextareaFieldProps = SharedProps & { multiline: true } & ComponentPropsWithRef<'textarea'>

/**
 * Labelled input or textarea. The label is always visible and programmatically
 * associated, hints and errors are linked via aria-describedby, and errors are
 * conveyed with text as well as colour.
 */
export function TextField(props: InputFieldProps | TextareaFieldProps) {
  const { label, hint, error, counter, id, required } = props
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const messageId = `${fieldId}-message`
  const countId = `${fieldId}-count`
  const overLimit = counter ? counter.count > counter.limit : false
  const describedBy = [error || hint ? messageId : null, counter ? countId : null].filter(Boolean).join(' ')

  const fieldProps = {
    id: fieldId,
    className: [styles.input, props.multiline ? styles.textarea : null, error ? styles.invalid : null]
      .filter(Boolean)
      .join(' '),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  }

  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required ? (
          <>
            {' '}
            <span className={styles.required}>(required)</span>
          </>
        ) : null}
      </label>
      {props.multiline ? (
        <textarea {...stripShared(props)} {...fieldProps} />
      ) : (
        <input {...stripShared(props)} {...fieldProps} />
      )}
      <div className={styles.footer}>
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {error ? (
            <>
              <strong>Error:</strong> {error}
            </>
          ) : (
            hint
          )}
        </p>
        {counter ? (
          <p id={countId} className={overLimit ? styles.countLimit : styles.count}>
            {counter.count}/{counter.limit} <span className="visually-hidden">characters used</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}

function stripShared<T extends SharedProps & { multiline?: boolean }>(props: T) {
  const { label, hint, error, counter, multiline, ...rest } = props
  return rest
}
