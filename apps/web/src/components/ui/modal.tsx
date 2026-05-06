import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { cn } from '@/lib/utils';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ComponentChildren;
  footer?: ComponentChildren;
  class?: string;
};

export function Modal({ open, onClose, title, children, footer, class: className }: ModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        class={cn(
          'relative z-10 w-full max-w-2xl rounded-xl border bg-card text-card-foreground shadow-2xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div class="border-b border-border px-5 py-3 text-base font-semibold">
          {title}
        </div>
        <div class="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div class="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
