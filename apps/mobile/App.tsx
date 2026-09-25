import { StatusBar } from 'expo-status-bar';

import { AppProviders } from './src/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <AppProviders>
      <RootNavigator />
      <StatusBar style="dark" />
    </AppProviders>
  );
}
