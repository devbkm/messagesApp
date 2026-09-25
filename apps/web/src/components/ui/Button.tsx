import type { ComponentPropsWithRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { Spinner } from './Spinner'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: Variant
  loading?: boolean
  fullWidth?: boolean
}

function classNames(variant: Variant, fullWidth: boolean, extra?: string) {
  return [styles.button, styles[variant], fullWidth && styles.fullWidth, extra]
    .filter(Boolean)
    .join(' ')
}

/**
 * Button hierarchy: one `primary` action per page, `secondary` for alternatives,
 * `danger` for destructive confirmation, `ghost` for low-emphasis actions.
 */
export function Button({
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(variant, fullWidth, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="small" /> : null}
      <span className={styles.content}>{children}</span>
    </button>
  )
}

type ButtonLinkProps = LinkProps & { variant?: Variant; fullWidth?: boolean }

/** Navigation styled as a button. Uses a real link so it works with open-in-new-tab etc. */
export function ButtonLink({ variant = 'primary', fullWidth = false, className, ...rest }: ButtonLinkProps) {
  return <Link className={classNames(variant, fullWidth, className)} {...rest} />
}
