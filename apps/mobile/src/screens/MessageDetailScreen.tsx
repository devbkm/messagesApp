import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { Attachment } from '../api/types';
import { AppText, Button, ErrorState, LoadingState, Screen } from '../components/ui';
import { useMessage } from '../hooks/useMessages';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing } from '../theme/tokens';
import { describeError, isNotFound } from '../utils/errors';
import { formatDateTime, formatDateTimeForSpeech, formatFileSize } from '../utils/format';

export function MessageDetailScreen({ route, navigation }: RootStackScreenProps<'MessageDetail'>) {
  const { data: message, isPending, isError, error, refetch, isFetching } = useMessage(route.params.messageId);

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Loading message" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        {isNotFound(error) ? (
          <ErrorState
            title="Message not found"
            message="It may have been deleted. Go back to your inbox to see your current messages."
            action={<Button label="Back to inbox" variant="secondary" onPress={() => navigation.popToTop()} />}
          />
        ) : (
          <ErrorState
            title="Couldn't load this message"
            message={describeError(error)}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title" selectable testID="message-subject">
          {message.subject}
        </AppText>
        <AppText
          variant="caption"
          color="textMuted"
          accessibilityLabel={`Created ${formatDateTimeForSpeech(message.created_at)}`}
        >
          {formatDateTime(message.created_at)}
        </AppText>
      </View>
      <View style={styles.divider} />
      <AppText selectable style={styles.body}>
        {message.text}
      </AppText>
      {message.attachment ? <AttachmentCard attachment={message.attachment} /> : null}
    </Screen>
  );
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const details = `${attachment.content_type} · ${formatFileSize(attachment.size_bytes)}`;
  return (
    <View
      style={styles.attachment}
      accessible
      accessibilityLabel={`Attachment: ${attachment.filename}, ${details}`}
      testID="message-attachment"
    >
      <Ionicons name="document-attach-outline" size={24} color={colors.textMuted} />
      <View style={styles.attachmentText}>
        <AppText variant="caption" color="textMuted">
          Attachment
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {attachment.filename}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {details}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  body: {
    // Slightly looser leading for long-form reading.
    lineHeight: 26,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  attachmentText: {
    flex: 1,
    gap: spacing.xxs,
  },
});
