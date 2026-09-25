import { Button, ButtonLink, ErrorState } from '../components/ui'
import styles from './RouteErrorPage.module.css'

/**
 * Last-resort page for unexpected rendering errors, instead of a blank screen or
 * React Router's developer error view. Error details are deliberately not shown.
 */
export function RouteErrorPage() {
  return (
    <main id="main" className={styles.main}>
      <ErrorState
        title="Something went wrong"
        message="The page ran into an unexpected problem. Your messages are safe."
        action={
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <ButtonLink to="/" reloadDocument>
              Go to inbox
            </ButtonLink>
          </div>
        }
      />
    </main>
  )
}
