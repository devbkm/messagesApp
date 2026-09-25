import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { AppLayout } from './layouts/AppLayout'
import { CreateMessagePage } from './pages/CreateMessagePage'
import { InboxPage } from './pages/InboxPage'
import { MessageDetailPage } from './pages/MessageDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Routes mirror the mobile stack: Inbox → Message detail, Inbox → Create message. */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <InboxPage /> },
      { path: 'messages/new', element: <CreateMessagePage /> },
      { path: 'messages/:messageId', element: <MessageDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
