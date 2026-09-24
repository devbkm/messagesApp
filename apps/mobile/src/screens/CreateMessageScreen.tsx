import { Button, EmptyState, Screen } from '../components/ui';
import type { RootStackScreenProps } from '../navigation/types';

// Placeholder: the create-message form is implemented in a later phase.
export function CreateMessageScreen({ navigation }: RootStackScreenProps<'CreateMessage'>) {
  return (
    <Screen footer={<Button label="Back to inbox" variant="secondary" fullWidth onPress={() => navigation.goBack()} />}>
      <EmptyState title="New message" message="The form for writing a message will appear here." />
    </Screen>
  );
}
