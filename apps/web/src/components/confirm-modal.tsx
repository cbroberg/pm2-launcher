import type { JSX } from 'preact';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({ open, title, body, confirmLabel, destructive, onCancel, onConfirm }: Props): JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      class="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p class="text-sm text-muted-foreground">{body}</p>
    </Modal>
  );
}
