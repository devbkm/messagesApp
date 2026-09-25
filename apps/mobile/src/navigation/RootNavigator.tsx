import { createNavigationContainerRef, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CreateMessageScreen } from '../screens/CreateMessageScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { MessageDetailScreen } from '../screens/MessageDetailScreen';
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

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Inbox"
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { fontSize: typography.subheading.fontSize, fontWeight: '600', color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Inbox' }} />
        <Stack.Screen name="MessageDetail" component={MessageDetailScreen} options={{ title: 'Message' }} />
        <Stack.Screen
          name="CreateMessage"
          component={CreateMessageScreen}
          options={{ title: 'New message' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
