import { memo } from 'react';

import type { MessageSummary } from '../../api/types';
import { formatDateTime, formatDateTimeForSpeech } from '../../utils/format';
import { IconButton, ListRow } from '../ui';

type MessageListItemProps = {
  message: MessageSummary;
  onOpen: (message: MessageSummary) => void;
  onDelete: (message: MessageSummary) => void;
};

/** One inbox row: subject first, date/time as secondary text, and a delete action. */
export const MessageListItem = memo(function MessageListItem({ message, onOpen, onDelete }: MessageListItemProps) {
  const meta = `${formatDateTime(message.created_at)}${message.has_attachment ? ' · Attachment' : ''}`;
  const spoken = [
    message.subject,
    formatDateTimeForSpeech(message.created_at),
    message.has_attachment ? 'has attachment' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ListRow
      testID={`message-row-${message.id}`}
      title={message.subject}
      meta={meta}
      accessibilityLabel={spoken}
      accessibilityHint="Opens the message"
      onPress={() => onOpen(message)}
      trailing={
        <IconButton
          testID={`delete-message-${message.id}`}
          icon="trash-outline"
          tone="danger"
          accessibilityLabel={`Delete message: ${message.subject}`}
          accessibilityHint="Asks for confirmation before deleting"
          onPress={() => onDelete(message)}
        />
      }
    />
  );
});
