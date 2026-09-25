import { useCallback, useState } from 'react';
import { AccessibilityInfo, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import type { MessageSummary } from '../api/types';
import { MessageListItem } from '../components/messages/MessageListItem';
import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineError,
  ListSkeleton,
  Screen,
} from '../components/ui';
import { useDeleteMessage, useMessageList } from '../hooks/useMessages';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';
import { describeError } from '../utils/errors';

export function InboxScreen({ navigation }: RootStackScreenProps<'Inbox'>) {
  const messages = useMessageList();
  const deletion = useDeleteMessage();
  // The target outlives the dialog's visibility so its text stays intact while it fades out.
  const [pendingDelete, setPendingDelete] = useState<MessageSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(false);

  const openCreate = useCallback(() => navigation.navigate('CreateMessage'), [navigation]);
  const openMessage = useCallback(
    (message: MessageSummary) => navigation.navigate('MessageDetail', { messageId: message.id }),
    [navigation],
  );
  const resetDeletion = deletion.reset;
  const askToDelete = useCallback(
    (message: MessageSummary) => {
      resetDeletion();
      setPendingDelete(message);
      setDialogOpen(true);
    },
    [resetDeletion],
  );

  const confirmDelete = () => {
    // Guard against double taps while the request is in flight.
    if (!dialogOpen || !pendingDelete || deletion.isPending) return;
    deletion.mutate(pendingDelete.id, {
      onSuccess: () => {
        setDialogOpen(false);
        AccessibilityInfo.announceForAccessibility('Message deleted');
      },
    });
  };

  const cancelDelete = () => {
    if (deletion.isPending) return;
    setDialogOpen(false);
  };

  const refresh = async () => {
    setManualRefresh(true);
    try {
      await messages.refetch();
    } finally {
      setManualRefresh(false);
    }
  };

  const items = messages.data?.items;
  const hasMessages = Boolean(items && items.length > 0);

  let content;
  if (messages.isPending) {
    // Skeleton, not an empty state: we do not know yet whether the inbox is empty.
    content = <ListSkeleton label="Loading messages" />;
  } else if (messages.isError && !items) {
    content = (
      <ErrorState
        title="Couldn't load your messages"
        message={describeError(messages.error)}
        onRetry={() => void messages.refetch()}
        retrying={messages.isFetching}
      />
    );
  } else if (!hasMessages) {
    content = (
      <EmptyState
        title="Your inbox is empty"
        message="Messages you write are kept here. Create your first one to get started."
        action={<Button label="Write your first message" icon="add" onPress={openCreate} />}
      />
    );
  } else {
    content = (
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageListItem message={item} onOpen={openMessage} onDelete={askToDelete} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {messages.isRefetchError ? (
              <InlineError message={`Couldn't refresh. ${describeError(messages.error)}`} />
            ) : null}
            <AppText variant="caption" color="textMuted">
              {items!.length === 1 ? '1 message' : `${items!.length} messages`} · newest first
            </AppText>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={manualRefresh} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        testID="message-list"
      />
    );
  }

  return (
    <Screen
      footer={
        hasMessages ? (
          <Button
            label="New message"
            icon="add"
            fullWidth
            accessibilityHint="Opens the form to write a new message"
            onPress={openCreate}
          />
        ) : undefined
      }
    >
      {content}
      <ConfirmDialog
        visible={dialogOpen}
        title="Delete this message?"
        message={pendingDelete ? `"${pendingDelete.subject}" will be permanently deleted.` : ''}
        confirmLabel={deletion.isError ? 'Try again' : 'Delete'}
        destructive
        busy={deletion.isPending}
        error={deletion.isError ? `Couldn't delete the message. ${describeError(deletion.error)}` : undefined}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  listHeader: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
});
