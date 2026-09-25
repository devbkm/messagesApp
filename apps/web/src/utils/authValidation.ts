/**
 * Client-side mirror of the API's account rules (backend/app/schemas/auth.py), for
 * immediate feedback only. The server validates again and decides.
 */

export const NAME_MAX_LENGTH = 100
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

// Deliberately simple: one "@", something on both sides, a dot in the domain. The
// server performs the full RFC check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LoginValues = { email: string; password: string }
export type SignupValues = LoginValues & { name: string; confirmPassword: string }
export type FormErrors<T> = Partial<Record<keyof T, string>>

function emailError(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address, like name@example.com.'
  return undefined
}

export function validateLogin({ email, password }: LoginValues): FormErrors<LoginValues> {
  const errors: FormErrors<LoginValues> = {}
  const emailProblem = emailError(email)
  if (emailProblem) errors.email = emailProblem
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function validateSignup({ name, email, password, confirmPassword }: SignupValues): FormErrors<SignupValues> {
  const errors: FormErrors<SignupValues> = {}
  if (!name.trim()) errors.name = 'Enter your name.'
  else if (Array.from(name.trim()).length > NAME_MAX_LENGTH) errors.name = `Name can be at most ${NAME_MAX_LENGTH} characters.`

  const emailProblem = emailError(email)
  if (emailProblem) errors.email = emailProblem

  if (!password) errors.password = 'Choose a password.'
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  else if (password.length > PASSWORD_MAX_LENGTH) errors.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`

  if (!confirmPassword) errors.confirmPassword = 'Enter your password again.'
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.'

  return errors
}
