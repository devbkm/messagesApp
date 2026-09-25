/**
 * Client-side mirror of the API's rules (backend/app/schemas/message.py), identical to
 * the mobile app. The server validates again; this exists only for immediate feedback.
 */

export const SUBJECT_MAX_LENGTH = 40
export const TEXT_MAX_LENGTH = 10_000

export type MessageFormValues = { subject: string; text: string }
export type MessageFormErrors = Partial<Record<keyof MessageFormValues, string>>

/** Length as the server counts it: surrounding whitespace is trimmed first. */
export function effectiveLength(value: string): number {
  return value.trim().length
}

export function validateMessage({ subject, text }: MessageFormValues): MessageFormErrors {
  const errors: MessageFormErrors = {}

  const subjectLength = effectiveLength(subject)
  if (subjectLength === 0) {
    errors.subject = 'Enter a subject.'
  } else if (subjectLength > SUBJECT_MAX_LENGTH) {
    const excess = subjectLength - SUBJECT_MAX_LENGTH
    errors.subject = `Subject is ${excess} character${excess === 1 ? '' : 's'} too long (max ${SUBJECT_MAX_LENGTH}).`
  }

  const textLength = effectiveLength(text)
  if (textLength === 0) {
    errors.text = 'Enter a message.'
  } else if (textLength > TEXT_MAX_LENGTH) {
    errors.text = `Message is too long (max ${TEXT_MAX_LENGTH.toLocaleString('en')} characters).`
  }

  return errors
}
