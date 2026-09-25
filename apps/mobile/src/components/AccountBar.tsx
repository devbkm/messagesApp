import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useAuth, useCurrentUser } from '../auth/AuthProvider';
import { colors, spacing } from '../theme/tokens';
import { AppText, Button } from './ui';

/** Who is signed in, with a way to log out. */
export function AccountBar() {
  const auth = useAuth();
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    AccessibilityInfo.announceForAccessibility('Logging out');
    await auth.signOut();
  };

  return (
    <View style={styles.bar}>
      <View
        style={styles.text}
        accessible
        accessibilityLabel={`Signed in as ${user.name}, ${user.email}`}
      >
        <AppText variant="label" numberOfLines={1}>
          {user.name}
        </AppText>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {user.email}
        </AppText>
      </View>
      <Button
        label="Log out"
        variant="secondary"
        loading={signingOut}
        onPress={() => void signOut()}
        style={styles.button}
        testID="logout"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  button: {
    paddingHorizontal: spacing.lg,
  },
});
