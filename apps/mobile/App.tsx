import { StatusBar } from 'expo-status-bar';

import { AppProviders } from './src/AppProviders';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      <StatusBar style="dark" />
    </AppProviders>
  );
}
