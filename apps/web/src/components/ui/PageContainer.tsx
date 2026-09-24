import { useEffect, useRef, type ReactNode } from 'react'

import styles from './PageContainer.module.css'

const APP_NAME = 'Inbox'

type PageContainerProps = {
  title: string
  /** Optional element next to the title, e.g. the page's primary action. */
  actions?: ReactNode
  /** Link back to the previous level, rendered above the title. */
  backLink?: ReactNode
  children: ReactNode
}

/**
 * Standard page: sets the document title and moves focus to the page heading on
 * navigation, so screen-reader and keyboard users know the page changed.
 */
export function PageContainer({ title, actions, backLink, children }: PageContainerProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`
    headingRef.current?.focus()
  }, [title])

  return (
    <div className={styles.page}>
      {backLink ? <div className={styles.back}>{backLink}</div> : null}
      <header className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}
