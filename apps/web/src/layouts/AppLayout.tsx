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
