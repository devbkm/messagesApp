import styles from './Spinner.module.css'

/** Decorative spinner. Pair it with visible text or `aria-busy` so the state is announced. */
export function Spinner({ size = 'large' }: { size?: 'small' | 'large' }) {
  return <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />
}
