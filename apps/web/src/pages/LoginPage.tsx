import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import type { LoginInput } from '../api/types'
import { useAuth } from '../auth/AuthProvider'
import { Button, InlineError, NoticeBanner, PageContainer, TextField } from '../components/ui'
import { validateLogin, type LoginValues } from '../utils/authValidation'
import { describeError } from '../utils/errors'
import styles from './AuthPage.module.css'

type Field = keyof LoginValues

export function LoginPage() {
  const auth = useAuth()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)
  // On success the auth state changes and the route guard moves on to the inbox.
  const login = useMutation({ mutationFn: (input: LoginInput) => auth.signIn(input) })

  const errors = validateLogin(values)
  const visibleError = (field: Field) => (submitAttempted || touched[field] ? errors[field] : undefined)
  const notice = auth.status === 'signedOut' ? auth.notice : undefined

  const update = (field: Field) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (login.isError) login.reset()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (login.isPending) return // prevent duplicate submissions
    setSubmitAttempted(true)
    if (errors.email || errors.password) {
      ;(errors.email ? emailRef : passwordRef).current?.focus()
      return
    }
    auth.dismissNotice()
    login.mutate({ email: values.email.trim(), password: values.password })
  }

  return (
    <PageContainer title="Log in" subtitle="Welcome back. Log in to see your messages.">
      <form className={styles.form} onSubmit={submit} noValidate aria-busy={login.isPending || undefined}>
        {notice ? <NoticeBanner message={notice} /> : null}
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update('email')(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={visibleError('email')}
          readOnly={login.isPending}
        />
        <TextField
          ref={passwordRef}
          label="Password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => update('password')(event.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={visibleError('password')}
          readOnly={login.isPending}
        />
        {login.isError ? <InlineError message={describeError(login.error)} /> : null}
        <Button type="submit" fullWidth loading={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
        <p className={styles.switch}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </PageContainer>
  )
}
