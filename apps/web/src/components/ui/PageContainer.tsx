import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import styles from './PageContainer.module.css'

const APP_NAME = 'Inbox'

type PageContainerProps = {
  title: string
  /** Optional element next to the title, e.g. the page's primary action. */
  actions?: ReactNode
  /** Link back to the previous level, rendered above the title. */
  backLink?: ReactNode
  /** Secondary line under the title, e.g. a date. */
  subtitle?: ReactNode
  /** Lets the page move focus back to its heading (e.g. after deleting an item). */
  headingRef?: RefObject<HTMLHeadingElement | null>
  children: ReactNode
}

/**
 * Standard page: sets the document title and moves focus to the page heading on
 * navigation, so screen-reader and keyboard users know the page changed.
 */
export function PageContainer({ title, actions, backLink, subtitle, headingRef: externalRef, children }: PageContainerProps) {
  const internalRef = useRef<HTMLHeadingElement>(null)
  const headingRef = externalRef ?? internalRef

  useEffect(() => {
    document.title = title === APP_NAME ? APP_NAME : `${title} · ${APP_NAME}`
    headingRef.current?.focus()
  }, [title, headingRef])

  return (
    <div className={styles.page}>
      {backLink ? <div className={styles.back}>{backLink}</div> : null}
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {title}
          </h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}
