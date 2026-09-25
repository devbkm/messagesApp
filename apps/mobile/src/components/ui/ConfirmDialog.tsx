import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../../theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { InlineError } from './StateViews';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive. */
  destructive?: boolean;
  /** Shows progress on the confirm button and blocks dismissal while an action runs. */
  busy?: boolean;
  /** Shown inside the dialog when the action failed; the user can retry or cancel. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal confirmation for destructive or irreversible actions. Cancel is the
 * left/first action so the safe choice is reached first by screen readers.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dismiss = busy ? () => {} : onCancel;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel="Close dialog"
          importantForAccessibility="no"
        />
        <View style={styles.dialog} accessibilityViewIsModal>
          <AppText variant="heading">{title}</AppText>
          <AppText color="textMuted">{message}</AppText>
          {error ? <InlineError message={error} /> : null}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={busy} style={styles.action} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={busy}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  action: {
    flexGrow: 1,
    flexBasis: 120,
  },
});
