/** Wire types mirroring the backend's OpenAPI schemas (see backend/app/schemas). */

export type Attachment = {
  filename: string
  content_type: string
  size_bytes: number
}

export type MessageSummary = {
  id: string
  subject: string
  /** ISO 8601, UTC. */
  created_at: string
  has_attachment: boolean
}

export type Message = {
  id: string
  subject: string
  text: string
  /** ISO 8601, UTC. */
  created_at: string
  attachment: Attachment | null
}

export type MessageList = {
  items: MessageSummary[]
}

export type MessageCreate = {
  subject: string
  text: string
}

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: { field: string; message: string }[]
  }
}
