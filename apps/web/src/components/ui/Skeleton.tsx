import styles from './Skeleton.module.css'

/**
 * Static placeholder rows shaped like the inbox list, announced once as "loading".
 * No shimmer animation, to keep motion to a minimum.
 */
export function ListSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className={styles.list} data-testid="list-skeleton">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.row} aria-hidden="true">
          <span className={styles.bar} style={{ width: index % 2 === 0 ? '70%' : '55%' }} />
          <span className={`${styles.bar} ${styles.small}`} style={{ width: '35%' }} />
        </div>
      ))}
    </div>
  )
}
