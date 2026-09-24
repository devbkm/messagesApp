import { Button, EmptyState, Screen } from '../components/ui';
import type { RootStackScreenProps } from '../navigation/types';

// Placeholder: the message list is implemented in a later phase.
export function InboxScreen({ navigation }: RootStackScreenProps<'Inbox'>) {
  return (
    <Screen
      footer={
        <Button
          label="New message"
          fullWidth
          accessibilityHint="Opens the form to write a new message"
          onPress={() => navigation.navigate('CreateMessage')}
        />
      }
    >
      <EmptyState title="No messages yet" message="Messages you create will appear here." />
    </Screen>
  );
}
