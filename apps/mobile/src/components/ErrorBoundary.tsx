import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';
import { ErrorState } from './ui';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort guard: an unexpected rendering error shows a recoverable screen instead
 * of a blank app. Error details are deliberately not displayed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <ErrorState
          title="Something went wrong"
          message="The app ran into an unexpected problem. Your messages are safe."
          onRetry={() => this.setState({ hasError: false })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
