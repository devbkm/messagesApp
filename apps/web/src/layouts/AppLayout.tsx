import { Link, Outlet } from 'react-router-dom'

import styles from './AppLayout.module.css'

/** App shell: skip link, top bar and a width-constrained main region. */
export function AppLayout() {
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.topBar}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand}>
            <svg className={styles.logo} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path
                d="M8 17v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-5a3 3 0 0 1-6 0H8Zm0-2h6.5a1 1 0 0 1 1 1 .5.5 0 0 0 1 0 1 1 0 0 1 1-1H24l-2.6-6.1A1.5 1.5 0 0 0 20 8h-8a1.5 1.5 0 0 0-1.4.9L8 15Z"
                fill="#fff"
              />
            </svg>
            Inbox
          </Link>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </>
  )
}
