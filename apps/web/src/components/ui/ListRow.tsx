import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import styles from './ListRow.module.css'

type ListRowProps = {
  title: string
  /** Secondary line, e.g. a date. */
  meta?: ReactNode
  to: string
  /** Optional trailing control (e.g. delete). Kept outside the link so it is its own tab stop. */
  trailing?: ReactNode
}

/** Card-style row for use inside a `<ul>`. The whole main area is one link target. */
export function ListRow({ title, meta, to, trailing }: ListRowProps) {
  return (
    <li className={styles.row}>
      <Link to={to} className={styles.main}>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </Link>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </li>
  )
}
