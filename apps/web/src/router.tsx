import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'

import { PublicOnly, RequireAuth } from './auth/guards'
import { AppLayout } from './layouts/AppLayout'
import { CreateMessagePage } from './pages/CreateMessagePage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { MessageDetailPage } from './pages/MessageDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RouteErrorPage } from './pages/RouteErrorPage'
import { SignupPage } from './pages/SignupPage'

/**
 * Routes mirror the mobile stack: Inbox → Message detail, Inbox → Create message.
 * Inbox routes require a session; /login and /signup are only for signed-out visitors.
 * The API enforces the same rules independently: these guards are for navigation only.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'signup', element: <SignupPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <InboxPage /> },
          { path: 'inbox', element: <Navigate to="/" replace /> },
          { path: 'messages/new', element: <CreateMessagePage /> },
          { path: 'messages/:messageId', element: <MessageDetailPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
