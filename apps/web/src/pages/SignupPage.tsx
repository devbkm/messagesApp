import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../api/client'
import type { SignupInput } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { Button, InlineError, PageContainer, TextField } from '../components/ui'
import { PASSWORD_MIN_LENGTH, validateSignup, type SignupValues } from '../utils/authValidation'
import { describeError } from '../utils/errors'
import styles from './AuthPage.module.css'

type Field = keyof SignupValues
const FIELDS: Field[] = ['name', 'email', 'password', 'confirmPassword']

export function SignupPage() {
  const auth = useAuth()
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<SignupValues>({ name: '', email: '', password: '', confirmPassword: '' })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  // On success the user is signed in and the route guard moves on to the inbox.
  const signup = useMutation({ mutationFn: (input: SignupInput) => auth.signUp(input) })

  const errors = validateSignup(values)
  const serverErrors = signupServerErrors(signup.error)
  const visibleError = (field: Field) =>
    (submitAttempted || touched[field] ? errors[field] : undefined) ?? serverErrors[field]

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (signup.isError) signup.reset()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (signup.isPending) return // prevent duplicate submissions
    setSubmitAttempted(true)
    const firstInvalid = FIELDS.find((field) => errors[field])
    if (firstInvalid) {
      const refs: Record<Field, RefObject<HTMLInputElement | null>> = {
        name: nameRef,
        email: emailRef,
        password: passwordRef,
        confirmPassword: confirmRef,
      }
      refs[firstInvalid].current?.focus()
      return
    }
    signup.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      password_confirmation: values.confirmPassword,
    })
  }

  // Field problems are shown next to the field; anything else goes in the banner.
  const bannerError = signup.isError && Object.keys(serverErrors).length === 0 ? describeError(signup.error) : null

  const field = (name: Field) => ({
    value: values[name],
    onChange: (event: { target: { value: string } }) => update(name)(event.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    error: visibleError(name),
    readOnly: signup.isPending,
  })

  return (
    <PageContainer title="Create account" subtitle="Your messages are private to your account.">
      <form className={styles.form} onSubmit={submit} noValidate aria-busy={signup.isPending || undefined}>
        <TextField ref={nameRef} {...field('name')} label="Name" placeholder="Your name" autoComplete="name" />
        <TextField
          ref={emailRef}
          {...field('email')}
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
        />
        <TextField
          ref={passwordRef}
          {...field('password')}
          label="Password"
          type="password"
          placeholder="Choose a password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          autoComplete="new-password"
        />
        <TextField
          ref={confirmRef}
          {...field('confirmPassword')}
          label="Confirm password"
          type="password"
          placeholder="Enter it again"
          autoComplete="new-password"
        />
        {bannerError ? <InlineError message={bannerError} /> : null}
        <Button type="submit" fullWidth loading={signup.isPending}>
          {signup.isPending ? 'Creating account…' : 'Create account'}
        </Button>
        <p className={styles.switch}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </PageContainer>
  )
}

/** Server-side problems keyed by form field (API names mapped to the form's). */
function signupServerErrors(error: unknown): Partial<Record<Field, string>> {
  if (!(error instanceof ApiError)) return {}
  if (error.code === 'email_taken') return { email: describeError(error) }
  const { name, email, password, password_confirmation: confirmPassword } = error.fieldErrors
  const mapped: Partial<Record<Field, string>> = { name, email, password, confirmPassword }
  return Object.fromEntries(Object.entries(mapped).filter(([, message]) => message))
}
