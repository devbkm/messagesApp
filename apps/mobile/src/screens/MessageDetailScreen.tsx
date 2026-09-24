import { EmptyState, Screen } from '../components/ui';
import type { RootStackScreenProps } from '../navigation/types';

// Placeholder: loading and displaying a message is implemented in a later phase.
export function MessageDetailScreen(_props: RootStackScreenProps<'MessageDetail'>) {
  return (
    <Screen>
      <EmptyState title="Message details" message="The subject, date and text of a message will appear here." />
    </Screen>
  );
}
