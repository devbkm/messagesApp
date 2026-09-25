import { createNavigationContainerRef, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthProvider';
import { CreateMessageScreen } from '../screens/CreateMessageScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MessageDetailScreen } from '../screens/MessageDetailScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { StartupScreen } from '../screens/StartupScreen';
import { colors, typography } from '../theme/tokens';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Lets code outside screens (and tests) navigate, e.g. to simulate a back press. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.danger,
  },
};

/**
 * Screens depend on the auth state, so protected screens do not exist at all for a
 * signed-out user (and vice versa). When the state changes, React Navigation moves to
 * the first screen of the new group: signing in lands on the Inbox, and signing out or
 * an expired session lands on Log in.
 */
export function RootNavigator() {
  const { status } = useAuth();

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontSize: typography.subheading.fontSize, fontWeight: '600', color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {status === 'signedIn' ? (
          <Stack.Group>
            <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
            <Stack.Screen name="MessageDetail" component={MessageDetailScreen} options={{ title: 'Message' }} />
            <Stack.Screen name="CreateMessage" component={CreateMessageScreen} options={{ title: 'New message' }} />
          </Stack.Group>
        ) : status === 'signedOut' ? (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Create account' }} />
          </Stack.Group>
        ) : (
          <Stack.Screen name="Startup" component={StartupScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
