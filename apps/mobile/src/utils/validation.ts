/**
 * Client-side mirror of the API's rules (backend/app/schemas/message.py). The server
 * validates again; this exists only to give immediate feedback.
 */

export const SUBJECT_MAX_LENGTH = 40;
export const TEXT_MAX_LENGTH = 10_000;

export type MessageFormValues = { subject: string; text: string };
export type MessageFormErrors = Partial<Record<keyof MessageFormValues, string>>;

// Same character classes as the API: control characters are never allowed in the
// subject; the text may contain line breaks and tabs only.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const TEXT_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
// Anything other than whitespace and invisible format characters (e.g. zero-width space).
const VISIBLE_CHARACTER = /[^\s\p{Cf}]/u;

/**
 * Length as the server counts it: surrounding whitespace is trimmed first and each
 * Unicode code point counts once (an emoji is 1, not the 2 that `.length` reports).
 */
export function effectiveLength(value: string): number {
  return Array.from(value.trim()).length;
}

export function validateMessage({ subject, text }: MessageFormValues): MessageFormErrors {
  const errors: MessageFormErrors = {};

  const subjectLength = effectiveLength(subject);
  if (!VISIBLE_CHARACTER.test(subject)) {
    errors.subject = 'Enter a subject.';
  } else if (CONTROL_CHARACTERS.test(subject.trim())) {
    errors.subject = 'Subject must be a single line.';
  } else if (subjectLength > SUBJECT_MAX_LENGTH) {
    const excess = subjectLength - SUBJECT_MAX_LENGTH;
    errors.subject = `Subject is ${excess} character${excess === 1 ? '' : 's'} too long (max ${SUBJECT_MAX_LENGTH}).`;
  }

  if (!VISIBLE_CHARACTER.test(text)) {
    errors.text = 'Enter a message.';
  } else if (TEXT_CONTROL_CHARACTERS.test(text)) {
    errors.text = 'Message contains unsupported characters.';
  } else if (effectiveLength(text) > TEXT_MAX_LENGTH) {
    errors.text = `Message is too long (max ${TEXT_MAX_LENGTH.toLocaleString('en')} characters).`;
  }

  return errors;
}
